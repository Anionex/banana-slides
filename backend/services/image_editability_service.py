"""
图片可编辑化服务 - 递归分析和拆解图片元素

核心功能：
1. 将任意尺寸的图片转换为可编辑结构
2. 递归分析图片中的子图和图表
3. 提取元素bbox、文字内容、inpaint后的子图
4. 巧妙处理父子坐标映射关系
"""
import os
import json
import logging
import tempfile
import uuid
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
from PIL import Image
from dataclasses import dataclass, field, asdict

from services.file_parser_service import FileParserService
from services.inpainting_service import InpaintingService
from utils.coordinate_utils import extract_elements_for_mask

logger = logging.getLogger(__name__)


@dataclass
class BBox:
    """边界框坐标"""
    x0: float
    y0: float
    x1: float
    y1: float
    
    @property
    def width(self) -> float:
        return self.x1 - self.x0
    
    @property
    def height(self) -> float:
        return self.y1 - self.y0
    
    @property
    def area(self) -> float:
        return self.width * self.height
    
    def to_tuple(self) -> Tuple[float, float, float, float]:
        """转换为元组格式 (x0, y0, x1, y1)"""
        return (self.x0, self.y0, self.x1, self.y1)
    
    def to_dict(self) -> Dict[str, float]:
        """转换为字典格式"""
        return {
            'x0': self.x0,
            'y0': self.y0,
            'x1': self.x1,
            'y1': self.y1
        }
    
    def scale(self, scale_x: float, scale_y: float) -> 'BBox':
        """缩放bbox"""
        return BBox(
            x0=self.x0 * scale_x,
            y0=self.y0 * scale_y,
            x1=self.x1 * scale_x,
            y1=self.y1 * scale_y
        )
    
    def translate(self, offset_x: float, offset_y: float) -> 'BBox':
        """平移bbox"""
        return BBox(
            x0=self.x0 + offset_x,
            y0=self.y0 + offset_y,
            x1=self.x1 + offset_x,
            y1=self.y1 + offset_y
        )


@dataclass
class EditableElement:
    """可编辑元素"""
    element_id: str  # 唯一标识
    element_type: str  # text, image, table, figure, equation等
    bbox: BBox  # 在当前图片坐标系中的位置
    bbox_global: BBox  # 在根图片坐标系中的位置
    content: Optional[str] = None  # 文字内容、HTML表格等
    image_path: Optional[str] = None  # 图片路径（MinerU提取的）
    
    # 递归子元素（如果是图片或图表，可能有子元素）
    children: List['EditableElement'] = field(default_factory=list)
    
    # 子图的inpaint背景（如果此元素是递归分析的图片/图表）
    inpainted_background: Optional[str] = None
    
    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（可序列化）"""
        result = {
            'element_id': self.element_id,
            'element_type': self.element_type,
            'bbox': self.bbox.to_dict(),
            'bbox_global': self.bbox_global.to_dict(),
            'content': self.content,
            'image_path': self.image_path,
            'inpainted_background': self.inpainted_background,
            'metadata': self.metadata,
            'children': [child.to_dict() for child in self.children]
        }
        return result


@dataclass
class EditableImage:
    """可编辑化的图片结构"""
    image_id: str  # 唯一标识
    image_path: str  # 原始图片路径
    width: int  # 图片宽度
    height: int  # 图片高度
    
    # 所有提取的元素
    elements: List[EditableElement] = field(default_factory=list)
    
    # Inpaint后的背景图（消除所有元素）
    clean_background: Optional[str] = None
    
    # MinerU解析结果目录
    mineru_result_dir: Optional[str] = None
    
    # 递归层级
    depth: int = 0
    
    # 父图片ID（如果是子图）
    parent_id: Optional[str] = None
    
    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（可序列化）"""
        return {
            'image_id': self.image_id,
            'image_path': self.image_path,
            'width': self.width,
            'height': self.height,
            'elements': [elem.to_dict() for elem in self.elements],
            'clean_background': self.clean_background,
            'mineru_result_dir': self.mineru_result_dir,
            'depth': self.depth,
            'parent_id': self.parent_id,
            'metadata': self.metadata
        }


class CoordinateMapper:
    """坐标映射工具 - 处理父子图片间的坐标转换"""
    
    @staticmethod
    def local_to_global(
        local_bbox: BBox,
        parent_bbox: BBox,
        local_image_size: Tuple[int, int],
        parent_image_size: Tuple[int, int]
    ) -> BBox:
        """
        将子图的局部坐标转换为父图（或根图）的全局坐标
        
        Args:
            local_bbox: 子图坐标系中的bbox
            parent_bbox: 子图在父图中的位置
            local_image_size: 子图尺寸 (width, height)
            parent_image_size: 父图尺寸 (width, height)
        
        Returns:
            在父图坐标系中的bbox
        """
        # 计算缩放比例（子图实际像素 vs 子图在父图中的bbox尺寸）
        scale_x = parent_bbox.width / local_image_size[0]
        scale_y = parent_bbox.height / local_image_size[1]
        
        # 先缩放到父图bbox的尺寸
        scaled_bbox = local_bbox.scale(scale_x, scale_y)
        
        # 再平移到父图bbox的位置
        global_bbox = scaled_bbox.translate(parent_bbox.x0, parent_bbox.y0)
        
        return global_bbox
    
    @staticmethod
    def global_to_local(
        global_bbox: BBox,
        parent_bbox: BBox,
        local_image_size: Tuple[int, int],
        parent_image_size: Tuple[int, int]
    ) -> BBox:
        """
        将父图的全局坐标转换为子图的局部坐标（逆向映射）
        
        Args:
            global_bbox: 父图坐标系中的bbox
            parent_bbox: 子图在父图中的位置
            local_image_size: 子图尺寸 (width, height)
            parent_image_size: 父图尺寸 (width, height)
        
        Returns:
            在子图坐标系中的bbox
        """
        # 先平移（相对于parent_bbox的原点）
        translated_bbox = global_bbox.translate(-parent_bbox.x0, -parent_bbox.y0)
        
        # 再缩放
        scale_x = local_image_size[0] / parent_bbox.width
        scale_y = local_image_size[1] / parent_bbox.height
        
        local_bbox = translated_bbox.scale(scale_x, scale_y)
        
        return local_bbox


class ImageEditabilityService:
    """
    图片可编辑化服务
    
    核心方法：make_image_editable() - 递归地将图片转换为可编辑结构
    """
    
    # 递归配置
    DEFAULT_MAX_DEPTH = 3  # 最大递归深度
    DEFAULT_MIN_IMAGE_SIZE = 200  # 最小图片尺寸（像素），小于此尺寸不再递归
    DEFAULT_MIN_IMAGE_AREA = 40000  # 最小图片面积（像素²），小于此面积不再递归
    
    def __init__(
        self,
        mineru_token: str,
        mineru_api_base: str = "https://mineru.net",
        inpainting_service: Optional[InpaintingService] = None,
        baidu_table_ocr_provider: Optional[Any] = None,
        max_depth: int = DEFAULT_MAX_DEPTH,
        min_image_size: int = DEFAULT_MIN_IMAGE_SIZE,
        min_image_area: int = DEFAULT_MIN_IMAGE_AREA,
        upload_folder: str = "./uploads"
    ):
        """
        初始化服务
        
        Args:
            mineru_token: MinerU API token
            mineru_api_base: MinerU API base URL
            inpainting_service: Inpainting服务实例
            baidu_table_ocr_provider: 百度表格OCR Provider实例
            max_depth: 最大递归深度
            min_image_size: 最小图片尺寸（宽或高）
            min_image_area: 最小图片面积
            upload_folder: 上传文件夹路径
        """
        self.mineru_token = mineru_token
        self.mineru_api_base = mineru_api_base
        
        # 确保upload_folder是绝对路径
        # 如果是相对路径（如 './uploads'），则相对于项目根目录计算
        upload_path = Path(upload_folder)
        if not upload_path.is_absolute():
            # 计算项目根目录（假设此文件在 backend/services/）
            current_file = Path(__file__).resolve()
            backend_dir = current_file.parent.parent
            project_root = backend_dir.parent
            self.upload_folder = project_root / upload_folder.lstrip('./')
        else:
            self.upload_folder = upload_path
        
        logger.info(f"Upload folder resolved to: {self.upload_folder}")
        
        # 初始化MinerU解析服务
        self.parser_service = FileParserService(
            mineru_token=mineru_token,
            mineru_api_base=mineru_api_base
        )
        
        # 初始化或使用提供的Inpainting服务
        if inpainting_service is None:
            try:
                from services.inpainting_service import get_inpainting_service
                self.inpainting_service = get_inpainting_service()
            except Exception as e:
                logger.warning(f"无法初始化Inpainting服务: {e}")
                self.inpainting_service = None
        else:
            self.inpainting_service = inpainting_service
        
        # 百度表格OCR Provider
        if baidu_table_ocr_provider is None:
            try:
                from services.ai_providers.ocr import create_baidu_table_ocr_provider
                self.baidu_table_ocr_provider = create_baidu_table_ocr_provider()
                if self.baidu_table_ocr_provider:
                    logger.info("✅ 百度表格OCR已启用")
            except Exception as e:
                logger.warning(f"无法初始化百度表格OCR: {e}")
                self.baidu_table_ocr_provider = None
        else:
            self.baidu_table_ocr_provider = baidu_table_ocr_provider
        
        # 递归配置
        self.max_depth = max_depth
        self.min_image_size = min_image_size
        self.min_image_area = min_image_area
        self.max_child_coverage_ratio = 0.85  # 子图占父图面积比例阈值，超过则不递归
        
        logger.info(f"ImageEditabilityService initialized with max_depth={max_depth}, min_size={min_image_size}, min_area={min_image_area}, max_coverage={self.max_child_coverage_ratio}")
    
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
        核心方法：将图片转换为可编辑结构（递归）
        
        Args:
            image_path: 图片路径
            depth: 当前递归深度
            parent_id: 父图片ID
            parent_bbox: 当前图片在父图中的bbox位置
            root_image_size: 根图片尺寸（用于全局坐标计算）
            element_type: 元素类型（如'table'），用于选择不同的识别服务
            root_image_path: 根图片路径（用于 Gemini inpainting）
        
        Returns:
            EditableImage 对象，包含所有提取的元素和子元素
        """
        image_id = str(uuid.uuid4())[:8]
        logger.info(f"{'  ' * depth}[Depth {depth}] 开始处理图片 {image_path} (ID: {image_id})")
        
        # 1. 加载图片，获取尺寸
        img = Image.open(image_path)
        width, height = img.size
        logger.info(f"{'  ' * depth}图片尺寸: {width}x{height}")
        
        # 如果是根图片，记录根图片尺寸和路径
        if root_image_size is None:
            root_image_size = (width, height)
        if root_image_path is None:
            root_image_path = image_path
        
        # 2. 根据元素类型选择识别服务
        if element_type == 'table' and self.baidu_table_ocr_provider:
            # 表格图片：使用百度OCR识别单元格
            logger.info(f"{'  ' * depth}Step 1: 使用百度OCR识别表格...")
            elements = self._extract_elements_from_baidu_ocr(
                image_path=image_path,
                target_image_size=(width, height),
                depth=depth,
                parent_bbox=parent_bbox,
                root_image_size=root_image_size,
                image_id=image_id
            )
            mineru_result_dir = None
        else:
            # 普通图片：使用MinerU解析
            # 先检查是否有缓存的MinerU结果
            cached_result_dir = self._find_cached_mineru_result(image_path)
            
            if cached_result_dir:
                logger.info(f"{'  ' * depth}Step 1: 使用缓存的MinerU结果...")
                logger.info(f"{'  ' * depth}  ✓ 找到缓存: {cached_result_dir.name}")
                mineru_result_dir = cached_result_dir
            else:
                logger.info(f"{'  ' * depth}Step 1: 转换为PDF并上传MinerU...")
                pdf_path = self._convert_image_to_pdf(image_path)
                
                try:
                    batch_id, markdown_content, extract_id, error_message, failed_image_count = \
                        self.parser_service.parse_file(pdf_path, f"image_{image_id}.pdf")
                    
                    if error_message or not extract_id:
                        logger.error(f"{'  ' * depth}MinerU解析失败: {error_message}")
                        # 返回空的可编辑结构
                        return EditableImage(
                            image_id=image_id,
                            image_path=image_path,
                            width=width,
                            height=height,
                            depth=depth,
                            parent_id=parent_id,
                            metadata={'error': error_message}
                        )
                    
                    logger.info(f"{'  ' * depth}MinerU解析成功, extract_id: {extract_id}")
                    
                    # 获取MinerU结果目录（绝对路径）
                    mineru_result_dir = (self.upload_folder / 'mineru_files' / extract_id).resolve()
                    logger.info(f"{'  ' * depth}检查MinerU结果目录: {mineru_result_dir}")
                    
                    if not mineru_result_dir.exists():
                        logger.error(f"{'  ' * depth}MinerU结果目录不存在: {mineru_result_dir}")
                        return EditableImage(
                            image_id=image_id,
                            image_path=image_path,
                            width=width,
                            height=height,
                            depth=depth,
                            parent_id=parent_id
                        )
                
                finally:
                    # 清理临时PDF
                    if os.path.exists(pdf_path):
                        os.remove(pdf_path)
            
            # 3. 从MinerU结果提取元素
            logger.info(f"{'  ' * depth}Step 2: 提取元素...")
            elements = self._extract_elements_from_mineru(
                mineru_result_dir=str(mineru_result_dir),
                target_image_size=(width, height),
                depth=depth,
                parent_bbox=parent_bbox,
                root_image_size=root_image_size,
                image_id=image_id
            )
        
        logger.info(f"{'  ' * depth}提取到 {len(elements)} 个元素")
        
        # 4. 生成clean background（使用inpainting消除所有元素）
        clean_background = None
        if self.inpainting_service and elements:
            logger.info(f"{'  ' * depth}Step 3: 生成clean background...")
            # 计算当前图像在根图像中的 crop_box
            if depth == 0:
                # 根图像，crop_box 就是整个图像
                current_crop_box = (0, 0, width, height)
            elif parent_bbox:
                # 子图像，使用 bbox_global（在根图像坐标系中的位置）
                current_crop_box = (
                    int(parent_bbox.x0),
                    int(parent_bbox.y0),
                    int(parent_bbox.x1),
                    int(parent_bbox.y1)
                )
            else:
                current_crop_box = None
            
            clean_background = self._generate_clean_background(
                image_path=image_path,
                elements=elements,
                image_id=image_id,
                root_image_path=root_image_path,
                crop_box=current_crop_box
            )
            if clean_background:
                logger.info(f"{'  ' * depth}Clean background生成成功: {clean_background}")
        
        # 5. 递归处理图片和图表类型的元素
        if depth < self.max_depth:
            logger.info(f"{'  ' * depth}Step 4: 递归处理子图...")
            self._process_children_recursively(
                elements=elements,
                mineru_result_dir=str(mineru_result_dir),
                depth=depth,
                image_id=image_id,
                root_image_size=root_image_size,
                current_image_size=(width, height),
                root_image_path=root_image_path
            )
        else:
            logger.info(f"{'  ' * depth}已达最大递归深度 {self.max_depth}，不再递归")
        
        # 6. 构建EditableImage对象
        editable_image = EditableImage(
            image_id=image_id,
            image_path=image_path,
            width=width,
            height=height,
            elements=elements,
            clean_background=clean_background,
            mineru_result_dir=str(mineru_result_dir),
            depth=depth,
            parent_id=parent_id
        )
        
        logger.info(f"{'  ' * depth}[Depth {depth}] 图片处理完成 (ID: {image_id})")
        return editable_image
    
    def _convert_image_to_pdf(self, image_path: str) -> str:
        """将单张图片转换为PDF"""
        from services.export_service import ExportService
        
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_pdf:
            pdf_path = tmp_pdf.name
        
        ExportService.create_pdf_from_images([image_path], output_file=pdf_path)
        return pdf_path
    
    def _extract_elements_from_baidu_ocr(
        self,
        image_path: str,
        target_image_size: Tuple[int, int],
        depth: int,
        parent_bbox: Optional[BBox],
        root_image_size: Tuple[int, int],
        image_id: str
    ) -> List[EditableElement]:
        """
        使用百度OCR从表格图片中提取单元格元素（与_extract_elements_from_mineru并行）
        
        Args:
            image_path: 表格图片路径
            target_image_size: 目标图片尺寸
            depth: 递归深度
            parent_bbox: 父元素bbox
            root_image_size: 根图片尺寸
            image_id: 图片ID
            
        Returns:
            EditableElement列表（单元格）
        """
        elements = []
        
        try:
            # 调用百度OCR识别表格
            ocr_result = self.baidu_table_ocr_provider.recognize_table(
                image_path,
                cell_contents=True
            )
            
            table_cells = ocr_result.get('cells', [])
            table_img_size = ocr_result.get('image_size', target_image_size)
            
            logger.info(f"{'  ' * depth}识别到 {len(table_cells)} 个单元格")
            
            # 只处理body单元格
            body_cells = [cell for cell in table_cells if cell.get('section') == 'body']
            
            # 收集所有有效单元格的bbox
            valid_cells = []
            for cell in body_cells:
                if cell.get('text', '').strip():
                    valid_cells.append(cell)
            
            if not valid_cells:
                logger.warning(f"{'  ' * depth}没有有效的单元格")
                return elements
            
            # 目标最小间距（像素）
            TARGET_MIN_GAP = 6
            # 每次收缩步长（比例）
            SHRINK_STEP = 0.02  # 2%
            # 最小保留比例
            MIN_SIZE_RATIO = 0.4  # 保留至少40%
            # 最大迭代次数
            MAX_ITERATIONS = 20
            
            # 初始化单元格bbox（可能会被迭代收缩）
            cell_data = []
            for cell in valid_cells:
                bbox = cell.get('bbox', [0, 0, 0, 0])
                x0, y0, x1, y1 = bbox
                cell_data.append({
                    'cell': cell,
                    'original_bbox': bbox,
                    'current_bbox': [float(x0), float(y0), float(x1), float(y1)],
                    'original_width': x1 - x0,
                    'original_height': y1 - y0
                })
            
            def calculate_min_gap(cell_data):
                """计算当前所有单元格间的最小间距（支持合并单元格）"""
                if len(cell_data) <= 1:
                    return float('inf')
                
                min_gap = float('inf')
                for i, data1 in enumerate(cell_data):
                    x0_1, y0_1, x1_1, y1_1 = data1['current_bbox']
                    for j, data2 in enumerate(cell_data):
                        if i >= j:
                            continue
                        x0_2, y0_2, x1_2, y1_2 = data2['current_bbox']
                        
                        # 计算两个矩形之间的最小距离（考虑所有方向）
                        # 不依赖行列对齐判断，直接计算实际间距
                        
                        # 检查X方向是否有重叠
                        x_overlap = not (x1_1 <= x0_2 or x1_2 <= x0_1)
                        # 检查Y方向是否有重叠
                        y_overlap = not (y1_1 <= y0_2 or y1_2 <= y0_1)
                        
                        if x_overlap and y_overlap:
                            # 两个单元格重叠，间距为负数
                            # 计算重叠区域的大小
                            overlap_x = min(x1_1, x1_2) - max(x0_1, x0_2)
                            overlap_y = min(y1_1, y1_2) - max(y0_1, y0_2)
                            min_gap = min(min_gap, -min(overlap_x, overlap_y))
                        elif x_overlap:
                            # X方向有重叠，Y方向分离（垂直相邻）
                            if y1_1 <= y0_2:
                                gap = y0_2 - y1_1
                            else:
                                gap = y0_1 - y1_2
                            min_gap = min(min_gap, gap)
                        elif y_overlap:
                            # Y方向有重叠，X方向分离（水平相邻）
                            if x1_1 <= x0_2:
                                gap = x0_2 - x1_1
                            else:
                                gap = x0_1 - x1_2
                            min_gap = min(min_gap, gap)
                        else:
                            # 两个方向都不重叠（对角相邻），计算最近角的距离
                            # 这种情况一般不需要考虑，因为不是直接相邻
                            pass
                
                return min_gap
            
            # 迭代收缩直到满足要求
            iteration = 0
            total_shrink_ratio = 0
            
            while iteration < MAX_ITERATIONS:
                current_min_gap = calculate_min_gap(cell_data)
                
                # 检查是否满足要求
                if current_min_gap >= TARGET_MIN_GAP:
                    if iteration == 0:
                        logger.info(f"{'  ' * depth}单元格间距已满足要求（最小={current_min_gap:.1f}px ≥ {TARGET_MIN_GAP}px），无需收缩")
                    else:
                        logger.info(f"{'  ' * depth}收缩完成：经过{iteration}次迭代，最小间距={current_min_gap:.1f}px，总收缩比例={total_shrink_ratio*100:.1f}%")
                    break
                
                # 继续收缩
                all_cells_can_shrink = True
                for data in cell_data:
                    x0, y0, x1, y1 = data['current_bbox']
                    current_width = x1 - x0
                    current_height = y1 - y0
                    
                    # 检查是否还能收缩（是否达到最小尺寸）
                    min_width = data['original_width'] * MIN_SIZE_RATIO
                    min_height = data['original_height'] * MIN_SIZE_RATIO
                    
                    if current_width <= min_width or current_height <= min_height:
                        all_cells_can_shrink = False
                        break
                    
                    # 计算本次收缩量
                    shrink_x = max(0.5, current_width * SHRINK_STEP)
                    shrink_y = max(0.5, current_height * SHRINK_STEP)
                    
                    # 应用收缩
                    new_x0 = x0 + shrink_x
                    new_y0 = y0 + shrink_y
                    new_x1 = x1 - shrink_x
                    new_y1 = y1 - shrink_y
                    
                    # 确保不超过最小尺寸
                    if (new_x1 - new_x0) < min_width:
                        new_x0 = x0 + (current_width - min_width) / 2
                        new_x1 = x1 - (current_width - min_width) / 2
                    if (new_y1 - new_y0) < min_height:
                        new_y0 = y0 + (current_height - min_height) / 2
                        new_y1 = y1 - (current_height - min_height) / 2
                    
                    # 更新bbox
                    data['current_bbox'] = [new_x0, new_y0, new_x1, new_y1]
                
                if not all_cells_can_shrink:
                    logger.warning(f"{'  ' * depth}达到最小尺寸限制，停止收缩。当前最小间距={current_min_gap:.1f}px")
                    break
                
                total_shrink_ratio += SHRINK_STEP
                iteration += 1
            
            if iteration >= MAX_ITERATIONS:
                current_min_gap = calculate_min_gap(cell_data)
                logger.warning(f"{'  ' * depth}达到最大迭代次数({MAX_ITERATIONS})，当前最小间距={current_min_gap:.1f}px")
            
            # 使用最终的收缩后bbox创建元素
            for idx, data in enumerate(cell_data):
                cell = data['cell']
                text = cell.get('text', '')
                cell_x0, cell_y0, cell_x1, cell_y1 = data['current_bbox']
                
                # 创建局部bbox（已收缩）
                local_bbox = BBox(
                    x0=float(cell_x0),
                    y0=float(cell_y0),
                    x1=float(cell_x1),
                    y1=float(cell_y1)
                )
                
                # 映射到全局坐标
                if parent_bbox is None:
                    global_bbox = local_bbox
                else:
                    global_bbox = CoordinateMapper.local_to_global(
                        local_bbox=local_bbox,
                        parent_bbox=parent_bbox,
                        local_image_size=table_img_size,
                        parent_image_size=root_image_size
                    )
                
                # 创建单元格元素
                element = EditableElement(
                    element_id=f"{image_id}_cell_{idx}",
                    element_type='table_cell',
                    bbox=local_bbox,
                    bbox_global=global_bbox,
                    content=text,
                    image_path=None,
                    metadata={
                        'row_start': cell.get('row_start'),
                        'row_end': cell.get('row_end'),
                        'col_start': cell.get('col_start'),
                        'col_end': cell.get('col_end'),
                        'table_idx': cell.get('table_idx', 0)
                    }
                )
                
                elements.append(element)
            
            logger.info(f"{'  ' * depth}提取了 {len(elements)} 个单元格元素")
        
        except Exception as e:
            logger.error(f"{'  ' * depth}百度OCR识别失败: {e}", exc_info=True)
        
        return elements
    
    def _extract_elements_from_mineru(
        self,
        mineru_result_dir: str,
        target_image_size: Tuple[int, int],
        depth: int,
        parent_bbox: Optional[BBox],
        root_image_size: Tuple[int, int],
        image_id: str
    ) -> List[EditableElement]:
        """从MinerU结果中提取元素（完整信息，包括content和img_path）"""
        elements = []
        
        try:
            mineru_dir = Path(mineru_result_dir)
            
            # 加载layout.json和content_list.json
            layout_file = mineru_dir / 'layout.json'
            content_list_files = list(mineru_dir.glob("*_content_list.json"))
            
            if not layout_file.exists() or not content_list_files:
                logger.warning(f"layout.json或content_list.json不存在")
                return []
            
            import json
            with open(layout_file, 'r', encoding='utf-8') as f:
                layout_data = json.load(f)
            
            with open(content_list_files[0], 'r', encoding='utf-8') as f:
                content_list = json.load(f)
            
            # 构建文本映射（用于查找content）
            text_map = {}
            for item in content_list:
                if item.get('type') in ['text', 'title'] and 'text' in item:
                    text = item['text'].strip()
                    if text:
                        # 使用bbox作为key（可能不精确，但是暂时可用）
                        bbox_key = tuple(item.get('bbox', []))
                        text_map[bbox_key] = text
            
            # 从layout.json提取完整信息
            if 'pdf_info' not in layout_data or not layout_data['pdf_info']:
                return []
            
            page_info = layout_data['pdf_info'][0]  # 第一页
            source_page_size = page_info.get('page_size', target_image_size)
            
            # 计算缩放比例
            scale_x = target_image_size[0] / source_page_size[0]
            scale_y = target_image_size[1] / source_page_size[1]
            
            for idx, block in enumerate(page_info.get('para_blocks', [])):
                bbox = block.get('bbox')
                block_type = block.get('type', 'text')
                
                if not bbox or len(bbox) != 4:
                    continue
                
                # 缩放bbox到目标尺寸
                scaled_bbox = [
                    bbox[0] * scale_x,
                    bbox[1] * scale_y,
                    bbox[2] * scale_x,
                    bbox[3] * scale_y
                ]
                
                # 局部坐标
                local_bbox = BBox(
                    x0=scaled_bbox[0],
                    y0=scaled_bbox[1],
                    x1=scaled_bbox[2],
                    y1=scaled_bbox[3]
                )
                
                # 全局坐标
                if parent_bbox is None:
                    global_bbox = local_bbox
                else:
                    global_bbox = CoordinateMapper.local_to_global(
                        local_bbox=local_bbox,
                        parent_bbox=parent_bbox,
                        local_image_size=target_image_size,
                        parent_image_size=root_image_size
                    )
                
                # 提取content（文本）
                content = None
                if block_type in ['text', 'title']:
                    # 从block中提取文本
                    if block.get('lines'):
                        text_parts = []
                        for line in block['lines']:
                            for span in line.get('spans', []):
                                if span.get('type') == 'text' and span.get('content'):
                                    text_parts.append(span['content'])
                        if text_parts:
                            content = '\n'.join(text_parts).strip()
                
                # 提取img_path（图片/表格）
                img_path = None
                if block_type in ['image', 'table']:
                    if block.get('blocks'):
                        for sub_block in block['blocks']:
                            for line in sub_block.get('lines', []):
                                for span in line.get('spans', []):
                                    if span.get('image_path'):
                                        img_path = span['image_path']
                                        # 确保路径格式正确
                                        if not img_path.startswith('images/'):
                                            img_path = 'images/' + img_path
                                        break
                                if img_path:
                                    break
                            if img_path:
                                break
                
                # 创建元素（表格在这里只是普通元素，带有image_path，稍后递归时用百度OCR处理）
                element = EditableElement(
                    element_id=f"{image_id}_{idx}",
                    element_type=block_type,
                    bbox=local_bbox,
                    bbox_global=global_bbox,
                    content=content,
                    image_path=img_path,
                    metadata=block
                )
                
                elements.append(element)
            
            logger.info(f"提取了 {len(elements)} 个完整元素（包含content和img_path）")
        
        except Exception as e:
            logger.error(f"提取元素失败: {e}", exc_info=True)
        
        return elements
    
    def _collect_bboxes_from_elements(self, elements: List[EditableElement]) -> List[tuple]:
        """
        收集当前层级元素的bbox列表（不递归到子元素）
        
        通用流程：
        - 对于当前图片，收集当前层级识别到的元素的 bbox
        - 对于所有元素，使用元素本身的 bbox，不递归到子元素
        - 子元素会在递归处理时，在子图上单独处理
        
        Args:
            elements: 元素列表
            
        Returns:
            bbox元组列表 [(x0, y0, x1, y1), ...]
        """
        bboxes = []
        for elem in elements:
            # 对于所有元素，使用元素本身的 bbox（不递归到子元素）
            bbox_tuple = elem.bbox.to_tuple()
            bboxes.append(bbox_tuple)
            logger.debug(f"元素 {elem.element_id} ({elem.element_type}): bbox={bbox_tuple}")
        return bboxes
    
    def _generate_clean_background(
        self,
        image_path: str,
        elements: List[EditableElement],
        image_id: str,
        expand_pixels: int = 10,
        root_image_path: Optional[str] = None,
        crop_box: Optional[tuple] = None
    ) -> Optional[str]:
        """生成clean background（消除所有元素）"""
        if not self.inpainting_service:
            logger.warning("Inpainting服务未初始化，跳过背景生成")
            return None
        
        try:
            # 准备bbox列表（对于有子元素的元素，只使用子元素的bbox）
            bboxes = self._collect_bboxes_from_elements(elements)
            
            logger.info(f"生成clean background，共 {len(bboxes)} 个bbox（已过滤有子元素的父元素）")
            
            # 加载图片
            img = Image.open(image_path)
            img_size = img.size
            img_width, img_height = img_size
            logger.info(f"图像尺寸: {img_width}x{img_height}")
            
            # 如果是 Gemini provider 且有根图像路径，加载完整页面图像
            full_page_img = None
            if self.inpainting_service.provider_type == "gemini" and root_image_path:
                logger.info(f"🌟 使用完整 PPT 页面图像进行 Gemini inpainting: {root_image_path}")
                full_page_img = Image.open(root_image_path)
            
            # 输出bbox详细信息，并检查是否覆盖过大
            if bboxes:
                # logger.info(f"将使用以下 {len(bboxes)} 个bbox生成mask（expand_pixels={expand_pixels}）:")
                filtered_bboxes = []
                for i, bbox in enumerate(bboxes):
                    if isinstance(bbox, (tuple, list)) and len(bbox) == 4:
                        x0, y0, x1, y1 = bbox
                        width = x1 - x0
                        height = y1 - y0
                        coverage_x = width / img_width if img_width > 0 else 0
                        coverage_y = height / img_height if img_height > 0 else 0
                        coverage = coverage_x * coverage_y
                        
                        if coverage > 0.95:
                            logger.warning(f"  bbox[{i+1}] 覆盖过大: ({x0}, {y0}, {x1}, {y1}) 尺寸: {width}x{height} 覆盖: {coverage*100:.1f}%，跳过")
                            continue
                        
                        # logger.info(f"  bbox[{i+1}] 原始: ({x0}, {y0}, {x1}, {y1}) 尺寸: {width}x{height} 覆盖: {coverage*100:.1f}%")
                        filtered_bboxes.append(bbox)
                    else:
                        filtered_bboxes.append(bbox)
                        # logger.info(f"  bbox[{i+1}]: {bbox}")
                
                if len(filtered_bboxes) < len(bboxes):
                    logger.warning(f"过滤了 {len(bboxes) - len(filtered_bboxes)} 个覆盖过大的bbox")
                    bboxes = filtered_bboxes
            
            # 准备输出目录
            output_dir = self.upload_folder / 'editable_images' / image_id
            output_dir.mkdir(parents=True, exist_ok=True)
            
            # mask保存路径
            mask_path = output_dir / 'mask.png'
            
            # 调用inpainting消除
            result_img = self.inpainting_service.remove_regions_by_bboxes(
                image=img,
                bboxes=bboxes,
                expand_pixels=expand_pixels,
                merge_bboxes=False,
                merge_threshold=20,
                save_mask_path=str(mask_path),
                full_page_image=full_page_img,
                crop_box=crop_box
            )
            
            if result_img is None:
                logger.warning("Inpainting失败")
                return None
            
            # 保存结果
            output_path = output_dir / 'clean_background.png'
            result_img.save(str(output_path))
            
            return str(output_path)
        
        except Exception as e:
            logger.error(f"生成clean background失败: {e}", exc_info=True)
            return None
    
    def _find_cached_mineru_result(self, image_path: str) -> Optional[Path]:
        """
        查找缓存的MinerU结果
        
        逻辑：
        1. 根据图片路径计算一个唯一的哈希值
        2. 在 mineru_files 目录下查找包含该哈希值或图片名称相关的目录
        3. 如果找不到，返回 None
        
        Args:
            image_path: 图片路径
            
        Returns:
            如果找到缓存的结果目录，返回Path；否则返回None
        """
        try:
            import hashlib
            import time
            
            # 获取图片文件信息
            img_path = Path(image_path)
            if not img_path.exists():
                return None
            
            # 计算文件的MD5哈希（用于缓存键）
            file_hash = hashlib.md5(img_path.read_bytes()).hexdigest()[:8]
            
            # MinerU结果存储目录
            mineru_files_dir = self.upload_folder / 'mineru_files'
            if not mineru_files_dir.exists():
                return None
            
            # 查找匹配的缓存目录
            # 策略1: 查找包含文件哈希的目录
            for cache_dir in mineru_files_dir.iterdir():
                if not cache_dir.is_dir():
                    continue
                
                # 检查是否有layout.json（MinerU结果的标志）
                if not (cache_dir / 'layout.json').exists():
                    continue
                
                # 检查缓存是否匹配（通过比较缓存目录中的元数据或时间戳）
                # 为了简单起见，我们检查最近修改时间（1小时内的缓存）
                cache_mtime = cache_dir.stat().st_mtime
                current_time = time.time()
                
                # 如果缓存是最近1小时内创建的，就认为可能是匹配的
                # 注意：这只是一个简单的启发式方法，可以根据需要改进
                if current_time - cache_mtime < 3600:  # 1小时
                    logger.debug(f"  找到可能的缓存: {cache_dir.name} (创建于 {int(current_time - cache_mtime)}秒前)")
                    # 可以在这里添加更精确的匹配逻辑
            
            # 策略2: 查找最新的缓存（如果没有找到精确匹配）
            # 这个策略可能不准确，所以我们暂时禁用它
            # latest_cache = max(mineru_files_dir.iterdir(), 
            #                    key=lambda p: p.stat().st_mtime if p.is_dir() else 0)
            
            # 目前我们不使用缓存，每次都重新解析
            # 这样更安全，避免使用错误的缓存
            logger.debug(f"  未找到匹配的MinerU缓存，将重新解析")
            return None
            
        except Exception as e:
            logger.debug(f"查找缓存MinerU结果时出错: {e}")
            return None
    
    def _should_recurse_into_element(
        self,
        element: EditableElement,
        mineru_result_dir: str,
        parent_image_size: Tuple[int, int]
    ) -> bool:
        """判断是否应该对元素进行递归分析
        
        Args:
            element: 待判断的元素
            mineru_result_dir: MinerU结果目录
            parent_image_size: 父图尺寸 (width, height)
        """
        # 如果已经有子元素（例如表格单元格），不再递归
        if element.children:
            logger.debug(f"  元素 {element.element_id} 已有 {len(element.children)} 个子元素，不递归")
            return False
        
        # 只对图片和图表类型递归
        if element.element_type not in ['image', 'figure', 'chart', 'table']:
            return False
        
        # 检查尺寸是否足够大
        bbox = element.bbox
        if bbox.width < self.min_image_size or bbox.height < self.min_image_size:
            logger.debug(f"  元素 {element.element_id} 尺寸过小 ({bbox.width}x{bbox.height})，不递归")
            return False
        
        if bbox.area < self.min_image_area:
            logger.debug(f"  元素 {element.element_id} 面积过小 ({bbox.area})，不递归")
            return False
        
        # 检查子图是否占据父图绝大部分面积
        parent_width, parent_height = parent_image_size
        parent_area = parent_width * parent_height
        coverage_ratio = bbox.area / parent_area if parent_area > 0 else 0
        
        if coverage_ratio > self.max_child_coverage_ratio:
            logger.info(f"  元素 {element.element_id} 占父图面积 {coverage_ratio*100:.1f}% (>{self.max_child_coverage_ratio*100:.0f}%)，不递归，直接使用原图")
            return False
        
        # 检查是否有对应的图片文件
        if not element.image_path:
            logger.debug(f"  元素 {element.element_id} 没有图片路径，不递归")
            return False
        
        # 尝试找到图片文件
        mineru_dir = Path(mineru_result_dir)
        possible_paths = [
            mineru_dir / element.image_path,
            mineru_dir / 'images' / Path(element.image_path).name,
            mineru_dir / Path(element.image_path).name,
        ]
        
        for path in possible_paths:
            if path.exists():
                element.metadata['resolved_image_path'] = str(path)
                return True
        
        logger.debug(f"  元素 {element.element_id} 图片文件未找到，不递归")
        return False
    
    def _process_children_recursively(
        self,
        elements: List[EditableElement],
        mineru_result_dir: str,
        depth: int,
        image_id: str,
        root_image_size: Tuple[int, int],
        current_image_size: Tuple[int, int],
        root_image_path: Optional[str] = None,
        max_workers: int = 4
    ):
        """递归处理子元素（并发处理，因为子元素之间无依赖）
        
        Args:
            elements: 待处理的元素列表
            mineru_result_dir: MinerU结果目录
            depth: 当前递归深度
            image_id: 当前图片ID
            root_image_size: 根图片尺寸
            current_image_size: 当前图片尺寸
            root_image_path: 根图片路径
            max_workers: 最大并发数（默认4）
        """
        # 筛选出需要递归处理的元素
        elements_to_process = []
        for element in elements:
            if self._should_recurse_into_element(element, mineru_result_dir, current_image_size):
                child_image_path = element.metadata.get('resolved_image_path')
                if child_image_path:
                    elements_to_process.append((element, child_image_path))
        
        if not elements_to_process:
            return
        
        # 如果只有一个元素，直接串行处理（避免线程开销）
        if len(elements_to_process) == 1:
            element, child_image_path = elements_to_process[0]
            logger.info(f"{'  ' * depth}  → 递归分析子图 {element.element_id} (类型: {element.element_type})")
            try:
                child_editable = self.make_image_editable(
                    image_path=child_image_path,
                    depth=depth + 1,
                    parent_id=image_id,
                    parent_bbox=element.bbox_global,
                    root_image_size=root_image_size,
                    element_type=element.element_type,
                    root_image_path=root_image_path
                )
                element.children = child_editable.elements
                element.inpainted_background = child_editable.clean_background
                element.metadata['child_mineru_result_dir'] = child_editable.mineru_result_dir
                logger.info(f"{'  ' * depth}  ✓ 子图分析完成，提取了 {len(child_editable.elements)} 个子元素")
            except Exception as e:
                logger.error(f"{'  ' * depth}  ✗ 递归处理失败: {e}", exc_info=True)
            return
        
        # 多个元素时，并发处理
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        logger.info(f"{'  ' * depth}  → 并发处理 {len(elements_to_process)} 个子图（max_workers={max_workers}）")
        
        def process_single_child(element, child_image_path):
            """处理单个子元素的函数"""
            logger.info(f"{'  ' * depth}  → 递归分析子图 {element.element_id} (类型: {element.element_type})")
            try:
                child_editable = self.make_image_editable(
                    image_path=child_image_path,
                    depth=depth + 1,
                    parent_id=image_id,
                    parent_bbox=element.bbox_global,
                    root_image_size=root_image_size,
                    element_type=element.element_type,
                    root_image_path=root_image_path
                )
                return (element, child_editable, None)
            except Exception as e:
                logger.error(f"{'  ' * depth}  ✗ 递归处理失败: {e}", exc_info=True)
                return (element, None, str(e))
        
        # 使用线程池并发处理
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(process_single_child, element, child_image_path): element
                for element, child_image_path in elements_to_process
            }
            
            for future in as_completed(futures):
                element, child_editable, error = future.result()
                if error:
                    continue
                
                if child_editable:
                    element.children = child_editable.elements
                    element.inpainted_background = child_editable.clean_background
                    element.metadata['child_mineru_result_dir'] = child_editable.mineru_result_dir
                    logger.info(f"{'  ' * depth}  ✓ 子图分析完成，提取了 {len(child_editable.elements)} 个子元素")
    
    def make_multi_images_editable(
        self,
        image_paths: List[str],
        parallel: bool = True,
        max_workers: int = 4
    ) -> List[EditableImage]:
        """
        批量处理多张图片（例如PPT的多页）
        
        Args:
            image_paths: 图片路径列表
            parallel: 是否并发处理
            max_workers: 最大并发数
        
        Returns:
            EditableImage列表
        """
        if not parallel or len(image_paths) == 1:
            # 串行处理
            results = []
            for idx, img_path in enumerate(image_paths):
                logger.info(f"处理第 {idx + 1}/{len(image_paths)} 张图片...")
                editable = self.make_image_editable(img_path)
                results.append(editable)
            return results
        
        # 并发处理
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        results = [None] * len(image_paths)
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_index = {
                executor.submit(self.make_image_editable, img_path): idx
                for idx, img_path in enumerate(image_paths)
            }
            
            for future in as_completed(future_to_index):
                idx = future_to_index[future]
                try:
                    results[idx] = future.result()
                    logger.info(f"✓ 第 {idx + 1}/{len(image_paths)} 张图片处理完成")
                except Exception as e:
                    logger.error(f"✗ 第 {idx + 1}/{len(image_paths)} 张图片处理失败: {e}")
                    # 创建空的结果
                    results[idx] = EditableImage(
                        image_id=f"error_{idx}",
                        image_path=image_paths[idx],
                        width=0,
                        height=0,
                        metadata={'error': str(e)}
                    )
        
        return results


# 便捷函数

def get_image_editability_service(
    mineru_token: str = None,
    mineru_api_base: str = None,
    **kwargs
) -> ImageEditabilityService:
    """
    获取ImageEditabilityService实例
    
    Args:
        mineru_token: MinerU token (如果不提供，从Flask config读取)
        mineru_api_base: MinerU API base (如果不提供，从Flask config读取)
        **kwargs: 其他参数传递给ImageEditabilityService
    
    Returns:
        ImageEditabilityService实例
    """
    # 如果没有提供token，尝试从Flask config获取
    if mineru_token is None or mineru_api_base is None:
        try:
            from flask import current_app
            mineru_token = mineru_token or current_app.config.get('MINERU_TOKEN')
            mineru_api_base = mineru_api_base or current_app.config.get('MINERU_API_BASE', 'https://mineru.net')
            upload_folder = kwargs.get('upload_folder') or current_app.config.get('UPLOAD_FOLDER', './uploads')
            kwargs['upload_folder'] = upload_folder
        except RuntimeError:
            # 不在Flask context中
            if mineru_token is None:
                raise ValueError("mineru_token必须提供或在Flask config中配置")
            mineru_api_base = mineru_api_base or 'https://mineru.net'
    
    return ImageEditabilityService(
        mineru_token=mineru_token,
        mineru_api_base=mineru_api_base,
        **kwargs
    )

