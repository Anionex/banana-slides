"""
图片可编辑化服务 - 核心服务类

设计原则：
1. 无状态设计 - 线程安全，可并行调用
2. 单一职责 - 只负责单张图片的可编辑化
3. 依赖注入 - 通过配置对象注入所有依赖
4. 零具体实现依赖 - 完全依赖抽象接口
"""
import logging
import uuid
from typing import List, Optional, Tuple
from PIL import Image

from .data_models import BBox, EditableElement, EditableImage
from .coordinate_mapper import CoordinateMapper
from .extractors import ElementExtractor, ExtractionResult
from .inpaint_providers import InpaintProvider
from .factories import ServiceConfig
from .helpers import collect_bboxes_from_elements, should_recurse_into_element, crop_element_from_image

logger = logging.getLogger(__name__)


class ImageEditabilityService:
    """
    图片可编辑化服务
    
    线程安全的无状态服务，可并行调用 make_image_editable()
    完全依赖抽象接口，不知道任何具体实现细节
    
    Example:
        >>> config = ServiceConfig.from_defaults(mineru_token="xxx")
        >>> service = ImageEditabilityService(config)
        >>> 
        >>> # 串行处理
        >>> result = service.make_image_editable("image.png")
        >>> 
        >>> # 并行处理（由调用者控制）
        >>> from concurrent.futures import ThreadPoolExecutor
        >>> with ThreadPoolExecutor() as executor:
        ...     futures = [executor.submit(service.make_image_editable, img) 
        ...                for img in image_paths]
        ...     results = [f.result() for f in futures]
    """
    
    def __init__(self, config: ServiceConfig):
        """
        初始化服务
        
        Args:
            config: ServiceConfig配置对象，包含所有依赖
        """
        # 只读配置，线程安全
        self._upload_folder = config.upload_folder
        self._extractor_registry = config.extractor_registry
        self._inpaint_registry = config.inpaint_registry
        self._max_depth = config.max_depth
        self._min_image_size = config.min_image_size
        self._min_image_area = config.min_image_area
        self._max_child_coverage_ratio = 0.85
        
        extractors = self._extractor_registry.get_all_extractors()
        inpaint_providers = self._inpaint_registry.get_all_providers()
        logger.info(
            f"ImageEditabilityService: {len(extractors)} extractors, "
            f"{len(inpaint_providers)} inpaint providers, "
            f"max_depth={self._max_depth}"
        )
    
    def make_image_editable(
        self,
        image_path: str,
        depth: int = 0,
        parent_id: Optional[str] = None,
        parent_bbox: Optional[BBox] = None,
        root_image_size: Optional[Tuple[int, int]] = None,
        element_type: Optional[str] = None,
        root_image_path: Optional[str] = None
    ) -> EditableImage:
        """
        将图片转换为可编辑结构（递归）
        
        线程安全：此方法可以被多个线程并行调用
        
        Args:
            image_path: 图片路径
            depth: 当前递归深度（内部使用）
            parent_id: 父图片ID（内部使用）
            parent_bbox: 当前图片在父图中的bbox位置（内部使用）
            root_image_size: 根图片尺寸（内部使用）
            element_type: 元素类型，用于选择提取器（内部使用）
            root_image_path: 根图片路径（内部使用）
        
        Returns:
            EditableImage对象
        
        Raises:
            FileNotFoundError: 图片文件不存在
            ValueError: 图片格式不支持
        """
        image_id = str(uuid.uuid4())[:8]
        logger.info(f"{'  ' * depth}[{image_id}] 开始处理")
        
        # 1. 加载图片
        try:
            img = Image.open(image_path)
            width, height = img.size
        except Exception as e:
            logger.error(f"无法加载图片 {image_path}: {e}")
            raise
        
        # 记录根图片信息
        if root_image_size is None:
            root_image_size = (width, height)
        if root_image_path is None:
            root_image_path = image_path
        
        # 2. 提取元素
        extraction_result = self._extract_elements(
            image_path=image_path,
            element_type=element_type,
            depth=depth
        )
        
        # 从context获取image_size（提取器自己获取）
        extracted_image_size = extraction_result.context.metadata.get('image_size', (width, height))
        
        elements = self._convert_to_editable_elements(
            element_dicts=extraction_result.elements,
            image_id=image_id,
            parent_bbox=parent_bbox,
            image_size=extracted_image_size,
            root_image_size=root_image_size,
            source_image_path=image_path  # 传入源图片路径用于裁剪
        )
        
        logger.info(f"{'  ' * depth}提取到 {len(elements)} 个元素")
        
        # 3. 生成clean background（根据元素类型选择重绘方法）
        clean_background = None
        if self._inpaint_registry and elements:
            clean_background = self._generate_clean_background(
                image_path=image_path,
                elements=elements,
                image_id=image_id,
                depth=depth,
                parent_bbox=parent_bbox,
                root_image_path=root_image_path,
                image_size=(width, height),
                element_type=element_type  # 传递元素类型以选择对应的重绘方法
            )
        
        # 4. 递归处理子元素
        # max_depth 语义：max_depth=1 表示只处理1层不递归，max_depth=2 递归一次
        if depth + 1 < self._max_depth:
            self._process_children(
                elements=elements,
                current_image_path=image_path,
                depth=depth,
                image_id=image_id,
                root_image_size=root_image_size,
                current_image_size=(width, height),
                root_image_path=root_image_path
            )
        
        # 5. 构建结果
        editable_image = EditableImage(
            image_id=image_id,
            image_path=image_path,
            width=width,
            height=height,
            elements=elements,
            clean_background=clean_background,
            depth=depth,
            parent_id=parent_id
        )
        
        logger.info(f"{'  ' * depth}[{image_id}] 处理完成")
        return editable_image
    
    def _extract_elements(
        self,
        image_path: str,
        element_type: Optional[str],
        depth: int
    ) -> ExtractionResult:
        """提取元素（完全依赖提取器接口）"""
        logger.info(f"{'  ' * depth}提取元素...")
        
        # 选择提取器
        extractor = self._select_extractor(element_type)
        
        # 调用提取器（提取器自己处理所有细节，包括获取image_size）
        return extractor.extract(
            image_path=image_path,
            element_type=element_type,
            depth=depth
        )
    
    def _select_extractor(self, element_type: Optional[str]) -> ElementExtractor:
        """根据元素类型从注册表选择对应的提取器"""
        extractor = self._extractor_registry.get_extractor(element_type)
        if extractor is None:
            raise ValueError(f"未找到元素类型 '{element_type}' 对应的提取器")
        return extractor
    
    def _convert_to_editable_elements(
        self,
        element_dicts: List[dict],
        image_id: str,
        parent_bbox: Optional[BBox],
        image_size: Tuple[int, int],
        root_image_size: Tuple[int, int],
        source_image_path: Optional[str] = None
    ) -> List[EditableElement]:
        """
        将提取器返回的字典转换为EditableElement对象
        
        对每个元素根据 bbox 从原图裁剪并保存图片，不依赖 MinerU 提取的图片。
        这样所有元素（包括文字）都有 image_path，可用于样式提取。
        """
        elements = []
        
        # 准备输出目录
        output_dir = None
        source_img = None
        if source_image_path:
            output_dir = self._upload_folder / 'editable_images' / image_id / 'elements'
            output_dir.mkdir(parents=True, exist_ok=True)
            try:
                source_img = Image.open(source_image_path)
            except Exception as e:
                logger.warning(f"无法加载源图片进行裁剪: {e}")
        
        for idx, elem_dict in enumerate(element_dicts):
            bbox_list = elem_dict['bbox']
            local_bbox = BBox(
                x0=bbox_list[0],
                y0=bbox_list[1],
                x1=bbox_list[2],
                y1=bbox_list[3]
            )
            
            # 计算全局坐标
            if parent_bbox is None:
                global_bbox = local_bbox
            else:
                global_bbox = CoordinateMapper.local_to_global(
                    local_bbox=local_bbox,
                    parent_bbox=parent_bbox,
                    local_image_size=image_size,
                    parent_image_size=root_image_size
                )
            
            # 为每个元素裁剪并保存图片（统一使用自己裁剪的图片）
            element_image_path = None
            if source_img and output_dir:
                try:
                    # 裁剪元素区域
                    crop_box = (
                        max(0, int(local_bbox.x0)),
                        max(0, int(local_bbox.y0)),
                        min(source_img.width, int(local_bbox.x1)),
                        min(source_img.height, int(local_bbox.y1))
                    )
                    
                    # 检查裁剪区域有效性
                    if crop_box[2] > crop_box[0] and crop_box[3] > crop_box[1]:
                        cropped = source_img.crop(crop_box)
                        element_image_path = str(output_dir / f"{idx}_{elem_dict['type']}.png")
                        cropped.save(element_image_path)
                except Exception as e:
                    logger.warning(f"裁剪元素 {idx} 失败: {e}")
            
            element = EditableElement(
                element_id=f"{image_id}_{idx}",
                element_type=elem_dict['type'],
                bbox=local_bbox,
                bbox_global=global_bbox,
                content=elem_dict.get('content'),
                image_path=element_image_path,  # 使用自己裁剪的图片路径
                metadata=elem_dict.get('metadata', {})
            )
            
            elements.append(element)
        
        # 关闭源图片
        if source_img:
            source_img.close()
        
        return elements
    
    def _generate_clean_background(
        self,
        image_path: str,
        elements: List[EditableElement],
        image_id: str,
        depth: int,
        parent_bbox: Optional[BBox],
        root_image_path: str,
        image_size: Tuple[int, int],
        element_type: Optional[str] = None
    ) -> Optional[str]:
        """
        生成clean background
        
        根据元素类型从注册表选择对应的重绘方法：
        - 如果指定了element_type，使用该类型对应的重绘方法
        - 否则使用默认的重绘方法
        """
        logger.info(f"{'  ' * depth}生成clean background (element_type={element_type})...")
        
        # 从注册表获取重绘方法
        inpaint_provider = self._inpaint_registry.get_provider(element_type)
        if inpaint_provider is None:
            logger.warning(f"{'  ' * depth}未找到重绘方法，跳过")
            return None
        
        try:
            bboxes = collect_bboxes_from_elements(elements)
            img = Image.open(image_path)
            img_width, img_height = img.size
            element_types = [elem.element_type for elem in elements]
            
            # 计算crop_box
            if depth == 0:
                crop_box = (0, 0, img_width, img_height)
            elif parent_bbox:
                crop_box = (
                    int(parent_bbox.x0),
                    int(parent_bbox.y0),
                    int(parent_bbox.x1),
                    int(parent_bbox.y1)
                )
            else:
                crop_box = None
            
            # 加载完整页面图像
            full_page_img = None
            if root_image_path != image_path:
                full_page_img = Image.open(root_image_path)
            
            # 过滤覆盖过大的bbox
            filtered_bboxes = []
            filtered_types = []
            for bbox, elem_type in zip(bboxes, element_types):
                if isinstance(bbox, (tuple, list)) and len(bbox) == 4:
                    x0, y0, x1, y1 = bbox
                    coverage = ((x1 - x0) * (y1 - y0)) / (img_width * img_height)
                    if coverage > 0.95:
                        continue
                filtered_bboxes.append(bbox)
                filtered_types.append(elem_type)
            
            if not filtered_bboxes:
                return None
            
            # 准备输出
            output_dir = self._upload_folder / 'editable_images' / image_id
            output_dir.mkdir(parents=True, exist_ok=True)
            
            # 调用注册表中选择的重绘方法
            logger.info(f"{'  ' * depth}使用 {inpaint_provider.__class__.__name__} 进行重绘")
            result_img = inpaint_provider.inpaint_regions(
                image=img,
                bboxes=filtered_bboxes,
                types=filtered_types,
                expand_pixels=10,
                save_mask_path=str(output_dir / 'mask.png'),
                full_page_image=full_page_img,
                crop_box=crop_box
            )
            
            if result_img is None:
                return None
            
            # 保存结果
            output_path = output_dir / 'clean_background.png'
            result_img.save(str(output_path))
            return str(output_path)
        
        except Exception as e:
            logger.error(f"生成clean background失败: {e}", exc_info=True)
            return None
    
    def _process_children(
        self,
        elements: List[EditableElement],
        current_image_path: str,
        depth: int,
        image_id: str,
        root_image_size: Tuple[int, int],
        current_image_size: Tuple[int, int],
        root_image_path: str
    ):
        """递归处理子元素（通过裁剪原图获取子图，并行处理多个子元素）"""
        logger.info(f"{'  ' * depth}递归处理子元素...")
        
        # 筛选需要递归的元素
        elements_to_process = []
        for element in elements:
            if should_recurse_into_element(
                element=element,
                parent_image_size=current_image_size,
                min_image_size=self._min_image_size,
                min_image_area=self._min_image_area,
                max_child_coverage_ratio=self._max_child_coverage_ratio
            ):
                elements_to_process.append(element)
        
        if not elements_to_process:
            return
        
        # 并行处理多个子元素
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        def process_single_element(element):
            """处理单个子元素"""
            try:
                # 从当前图片裁剪出子区域
                child_image_path = crop_element_from_image(
                    source_image_path=current_image_path,
                    bbox=element.bbox
                )
                
                child_editable = self.make_image_editable(
                    image_path=child_image_path,
                    depth=depth + 1,
                    parent_id=image_id,
                    parent_bbox=element.bbox_global,
                    root_image_size=root_image_size,
                    element_type=element.element_type,
                    root_image_path=root_image_path
                )
                
                return element, child_editable, None
            
            except Exception as e:
                return element, None, e
        
        logger.info(f"{'  ' * depth}  并行处理 {len(elements_to_process)} 个子元素...")
        
        # 使用线程池并行处理
        max_workers = min(8, len(elements_to_process))  # 限制并发数
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(process_single_element, elem): elem for elem in elements_to_process}
            
            for future in as_completed(futures):
                element, child_editable, error = future.result()
                
                if error:
                    logger.error(f"{'  ' * depth}  ✗ {element.element_id} 失败: {error}")
                else:
                    element.children = child_editable.elements
                    element.inpainted_background_path = child_editable.clean_background
                    logger.info(f"{'  ' * depth}  ✓ {element.element_id} 完成: {len(child_editable.elements)} 个子元素")
