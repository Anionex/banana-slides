"""
混合元素提取器 - 结合MinerU版面分析和百度高精度OCR的提取策略

工作流程：
1. MinerU和百度OCR并行识别（提升速度）
2. 结果合并：
   - 图片类型bbox里包含的百度OCR bbox → 删除百度OCR bbox
   - 表格类型bbox里包含的百度OCR bbox → 保留百度OCR bbox，删除MinerU表格bbox
   - 其他类型bbox与百度OCR bbox有交集 → 使用百度OCR结果，删除MinerU bbox
"""
import logging
from typing import Dict, Any, List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image

from .extractors import (
    ElementExtractor, 
    ExtractionResult, 
    ExtractionContext,
    MinerUElementExtractor,
    BaiduAccurateOCRElementExtractor
)

logger = logging.getLogger(__name__)


class BBoxUtils:
    """边界框工具类"""
    
    @staticmethod
    def is_contained(inner_bbox: List[float], outer_bbox: List[float], threshold: float = 0.8) -> bool:
        """
        判断inner_bbox是否被outer_bbox包含
        
        Args:
            inner_bbox: 内部bbox [x0, y0, x1, y1]
            outer_bbox: 外部bbox [x0, y0, x1, y1]
            threshold: 包含阈值，inner_bbox有多少比例在outer_bbox内算作包含，默认0.8
        
        Returns:
            是否被包含
        """
        if not inner_bbox or not outer_bbox:
            return False
        
        ix0, iy0, ix1, iy1 = inner_bbox
        ox0, oy0, ox1, oy1 = outer_bbox
        
        # 计算交集
        inter_x0 = max(ix0, ox0)
        inter_y0 = max(iy0, oy0)
        inter_x1 = min(ix1, ox1)
        inter_y1 = min(iy1, oy1)
        
        if inter_x1 <= inter_x0 or inter_y1 <= inter_y0:
            return False
        
        # 计算交集面积
        inter_area = (inter_x1 - inter_x0) * (inter_y1 - inter_y0)
        
        # 计算inner_bbox面积
        inner_area = (ix1 - ix0) * (iy1 - iy0)
        
        if inner_area <= 0:
            return False
        
        # 判断包含比例
        return (inter_area / inner_area) >= threshold
    
    @staticmethod
    def has_intersection(bbox1: List[float], bbox2: List[float], min_overlap_ratio: float = 0.1) -> bool:
        """
        判断两个bbox是否有交集
        
        Args:
            bbox1: 第一个bbox [x0, y0, x1, y1]
            bbox2: 第二个bbox [x0, y0, x1, y1]
            min_overlap_ratio: 最小重叠比例（相对于较小bbox的面积），默认0.1
        
        Returns:
            是否有交集
        """
        if not bbox1 or not bbox2:
            return False
        
        x0_1, y0_1, x1_1, y1_1 = bbox1
        x0_2, y0_2, x1_2, y1_2 = bbox2
        
        # 计算交集
        inter_x0 = max(x0_1, x0_2)
        inter_y0 = max(y0_1, y0_2)
        inter_x1 = min(x1_1, x1_2)
        inter_y1 = min(y1_1, y1_2)
        
        if inter_x1 <= inter_x0 or inter_y1 <= inter_y0:
            return False
        
        # 计算交集面积
        inter_area = (inter_x1 - inter_x0) * (inter_y1 - inter_y0)
        
        # 计算两个bbox的面积
        area1 = (x1_1 - x0_1) * (y1_1 - y0_1)
        area2 = (x1_2 - x0_2) * (y1_2 - y0_2)
        
        # 取较小面积作为基准
        min_area = min(area1, area2)
        
        if min_area <= 0:
            return False
        
        # 判断重叠比例
        return (inter_area / min_area) >= min_overlap_ratio
    
    @staticmethod
    def get_intersection_ratio(bbox1: List[float], bbox2: List[float]) -> Tuple[float, float]:
        """
        计算两个bbox的交集比例
        
        Args:
            bbox1: 第一个bbox
            bbox2: 第二个bbox
        
        Returns:
            (交集占bbox1的比例, 交集占bbox2的比例)
        """
        if not bbox1 or not bbox2:
            return (0.0, 0.0)
        
        x0_1, y0_1, x1_1, y1_1 = bbox1
        x0_2, y0_2, x1_2, y1_2 = bbox2
        
        # 计算交集
        inter_x0 = max(x0_1, x0_2)
        inter_y0 = max(y0_1, y0_2)
        inter_x1 = min(x1_1, x1_2)
        inter_y1 = min(y1_1, y1_2)
        
        if inter_x1 <= inter_x0 or inter_y1 <= inter_y0:
            return (0.0, 0.0)
        
        inter_area = (inter_x1 - inter_x0) * (inter_y1 - inter_y0)
        area1 = (x1_1 - x0_1) * (y1_1 - y0_1)
        area2 = (x1_2 - x0_2) * (y1_2 - y0_2)
        
        ratio1 = inter_area / area1 if area1 > 0 else 0.0
        ratio2 = inter_area / area2 if area2 > 0 else 0.0
        
        return (ratio1, ratio2)


class HybridElementExtractor(ElementExtractor):
    """
    混合元素提取器
    
    结合MinerU版面分析和百度高精度OCR，实现更精确的元素识别：
    - MinerU负责识别元素类型和整体布局
    - 百度OCR负责精确的文字识别和定位
    
    合并策略：
    1. 图片类型bbox里包含的百度OCR bbox → 删除（图片内的文字不需要单独提取）
    2. 表格类型bbox里包含的百度OCR bbox → 保留百度OCR结果，删除MinerU表格bbox
    3. 其他类型（文字等）与百度OCR bbox有交集 → 使用百度OCR结果，删除MinerU bbox
    """
    
    # 元素类型分类
    IMAGE_TYPES = {'image', 'figure', 'chart', 'diagram'}
    TABLE_TYPES = {'table', 'table_cell'}
    TEXT_TYPES = {'text', 'title', 'paragraph', 'header', 'footer', 'list'}
    
    def __init__(
        self,
        mineru_extractor: MinerUElementExtractor,
        baidu_ocr_extractor: BaiduAccurateOCRElementExtractor,
        contain_threshold: float = 0.8,
        intersection_threshold: float = 0.3
    ):
        """
        初始化混合提取器
        
        Args:
            mineru_extractor: MinerU元素提取器
            baidu_ocr_extractor: 百度高精度OCR提取器
            contain_threshold: 包含判断阈值，默认0.8（80%面积在内部算包含）
            intersection_threshold: 交集判断阈值，默认0.3（30%重叠算有交集）
        """
        self._mineru_extractor = mineru_extractor
        self._baidu_ocr_extractor = baidu_ocr_extractor
        self._contain_threshold = contain_threshold
        self._intersection_threshold = intersection_threshold
    
    def supports_type(self, element_type: Optional[str]) -> bool:
        """混合提取器支持所有类型"""
        return True
    
    def extract(
        self,
        image_path: str,
        element_type: Optional[str] = None,
        **kwargs
    ) -> ExtractionResult:
        """
        从图像中提取元素（混合策略）
        
        工作流程：
        1. 调用MinerU提取器获取版面分析结果
        2. 调用百度OCR提取器获取文字识别结果
        3. 合并结果
        
        Args:
            image_path: 图像文件路径
            element_type: 元素类型提示（可选）
            **kwargs: 其他参数
                - depth: 递归深度
                - language_type: 百度OCR语言类型
        
        Returns:
            合并后的ExtractionResult
        """
        depth = kwargs.get('depth', 0)
        indent = '  ' * depth
        
        logger.info(f"{indent}🔀 开始混合提取: {image_path}")
        
        # 1. MinerU版面分析 和 百度高精度OCR 并行执行
        logger.info(f"{indent}📄🔤 Step 1: MinerU + 百度OCR 并行识别...")
        
        mineru_result = None
        baidu_result = None
        
        def run_mineru():
            return self._mineru_extractor.extract(image_path, element_type, **kwargs)
        
        def run_baidu_ocr():
            return self._baidu_ocr_extractor.extract(image_path, element_type, **kwargs)
        
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_mineru = executor.submit(run_mineru)
            future_baidu = executor.submit(run_baidu_ocr)
            
            # 等待两个任务完成
            for future in as_completed([future_mineru, future_baidu]):
                try:
                    if future == future_mineru:
                        mineru_result = future.result()
                        logger.info(f"{indent}  ✅ MinerU识别到 {len(mineru_result.elements)} 个元素")
                    else:
                        baidu_result = future.result()
                        logger.info(f"{indent}  ✅ 百度OCR识别到 {len(baidu_result.elements)} 个元素")
                except Exception as e:
                    logger.error(f"{indent}  ❌ 提取失败: {e}")
        
        # 确保两个结果都存在
        if mineru_result is None:
            mineru_result = ExtractionResult(elements=[])
        if baidu_result is None:
            baidu_result = ExtractionResult(elements=[])
        
        mineru_elements = mineru_result.elements
        baidu_elements = baidu_result.elements
        
        # 2. 合并结果
        logger.info(f"{indent}🔧 Step 2: 合并结果...")
        merged_elements = self._merge_results(mineru_elements, baidu_elements, depth)
        logger.info(f"{indent}  合并后共 {len(merged_elements)} 个元素")
        
        # 合并上下文
        context = ExtractionContext(
            result_dir=mineru_result.context.result_dir,
            metadata={
                'source': 'hybrid',
                'mineru_count': len(mineru_elements),
                'baidu_count': len(baidu_elements),
                'merged_count': len(merged_elements),
                **mineru_result.context.metadata
            }
        )
        
        return ExtractionResult(elements=merged_elements, context=context)
    
    def _merge_results(
        self,
        mineru_elements: List[Dict[str, Any]],
        baidu_elements: List[Dict[str, Any]],
        depth: int = 0
    ) -> List[Dict[str, Any]]:
        """
        合并MinerU和百度OCR的结果
        
        合并规则：
        1. 图片类型bbox里包含的百度OCR bbox → 删除百度OCR bbox
        2. 表格类型bbox里包含的百度OCR bbox → 保留百度OCR bbox，删除MinerU表格bbox
        3. 其他类型与百度OCR bbox有交集 → 使用百度OCR结果，删除MinerU bbox
        
        Args:
            mineru_elements: MinerU识别的元素列表
            baidu_elements: 百度OCR识别的元素列表
            depth: 递归深度（用于日志）
        
        Returns:
            合并后的元素列表
        """
        indent = '  ' * depth
        
        # 分类MinerU元素
        image_elements = []
        table_elements = []
        other_elements = []
        
        for elem in mineru_elements:
            elem_type = elem.get('type', '')
            if elem_type in self.IMAGE_TYPES:
                image_elements.append(elem)
            elif elem_type in self.TABLE_TYPES:
                table_elements.append(elem)
            else:
                other_elements.append(elem)
        
        logger.info(f"{indent}  MinerU分类: 图片={len(image_elements)}, 表格={len(table_elements)}, 其他={len(other_elements)}")
        
        # 标记需要保留/删除的百度OCR元素
        baidu_to_keep = set(range(len(baidu_elements)))  # 初始全部保留
        baidu_in_table = set()  # 在表格内的百度OCR元素
        
        # 规则1: 图片类型bbox里包含的百度OCR bbox → 删除
        for img_elem in image_elements:
            img_bbox = img_elem.get('bbox', [])
            for idx, baidu_elem in enumerate(baidu_elements):
                baidu_bbox = baidu_elem.get('bbox', [])
                if BBoxUtils.is_contained(baidu_bbox, img_bbox, self._contain_threshold):
                    baidu_to_keep.discard(idx)
                    logger.debug(f"{indent}    百度OCR[{idx}]被图片包含，删除")
        
        # 规则2: 表格类型bbox里包含的百度OCR bbox → 保留，并标记
        tables_to_remove = set()
        for table_idx, table_elem in enumerate(table_elements):
            table_bbox = table_elem.get('bbox', [])
            has_contained_text = False
            for idx, baidu_elem in enumerate(baidu_elements):
                baidu_bbox = baidu_elem.get('bbox', [])
                if BBoxUtils.is_contained(baidu_bbox, table_bbox, self._contain_threshold):
                    baidu_in_table.add(idx)
                    has_contained_text = True
                    logger.debug(f"{indent}    百度OCR[{idx}]在表格内，保留")
            
            if has_contained_text:
                tables_to_remove.add(table_idx)
                logger.debug(f"{indent}    表格[{table_idx}]有文字，删除表格bbox")
        
        # 规则3: 其他类型与百度OCR bbox有交集 → 使用百度OCR结果
        other_to_remove = set()
        for other_idx, other_elem in enumerate(other_elements):
            other_bbox = other_elem.get('bbox', [])
            for idx, baidu_elem in enumerate(baidu_elements):
                if idx not in baidu_to_keep:
                    continue
                baidu_bbox = baidu_elem.get('bbox', [])
                if BBoxUtils.has_intersection(other_bbox, baidu_bbox, self._intersection_threshold):
                    other_to_remove.add(other_idx)
                    logger.debug(f"{indent}    MinerU其他[{other_idx}]与百度OCR[{idx}]有交集，使用百度OCR")
                    break
        
        # 构建最终结果
        merged = []
        
        # 添加图片元素（全部保留）
        for elem in image_elements:
            elem_copy = elem.copy()
            elem_copy['metadata'] = elem_copy.get('metadata', {}).copy()
            elem_copy['metadata']['source'] = 'mineru'
            merged.append(elem_copy)
        
        # 添加表格元素（删除有文字的表格bbox）
        for idx, elem in enumerate(table_elements):
            if idx not in tables_to_remove:
                elem_copy = elem.copy()
                elem_copy['metadata'] = elem_copy.get('metadata', {}).copy()
                elem_copy['metadata']['source'] = 'mineru'
                merged.append(elem_copy)
        
        # 添加其他MinerU元素（删除与百度OCR有交集的）
        for idx, elem in enumerate(other_elements):
            if idx not in other_to_remove:
                elem_copy = elem.copy()
                elem_copy['metadata'] = elem_copy.get('metadata', {}).copy()
                elem_copy['metadata']['source'] = 'mineru'
                merged.append(elem_copy)
        
        # 添加保留的百度OCR元素
        for idx in baidu_to_keep:
            elem = baidu_elements[idx]
            elem_copy = elem.copy()
            elem_copy['metadata'] = elem_copy.get('metadata', {}).copy()
            elem_copy['metadata']['source'] = 'baidu_ocr'
            if idx in baidu_in_table:
                elem_copy['metadata']['in_table'] = True
            merged.append(elem_copy)
        
        logger.info(f"{indent}  合并结果: 保留图片={len(image_elements)}, "
                   f"保留表格={len(table_elements) - len(tables_to_remove)}, "
                   f"保留MinerU其他={len(other_elements) - len(other_to_remove)}, "
                   f"保留百度OCR={len(baidu_to_keep)}")
        
        return merged


def create_hybrid_extractor(
    mineru_extractor: Optional[MinerUElementExtractor] = None,
    baidu_ocr_extractor: Optional[BaiduAccurateOCRElementExtractor] = None,
    parser_service: Optional[Any] = None,
    upload_folder: Optional[Any] = None,
    contain_threshold: float = 0.8,
    intersection_threshold: float = 0.3
) -> Optional[HybridElementExtractor]:
    """
    创建混合元素提取器
    
    Args:
        mineru_extractor: MinerU提取器（可选，自动创建）
        baidu_ocr_extractor: 百度OCR提取器（可选，自动创建）
        parser_service: FileParserService实例（用于创建MinerU提取器）
        upload_folder: 上传文件夹路径（用于创建MinerU提取器）
        contain_threshold: 包含判断阈值
        intersection_threshold: 交集判断阈值
    
    Returns:
        HybridElementExtractor实例，如果无法创建则返回None
    """
    from pathlib import Path
    
    # 创建MinerU提取器
    if mineru_extractor is None:
        if parser_service is None or upload_folder is None:
            logger.error("创建混合提取器需要提供 parser_service 和 upload_folder，或者直接提供 mineru_extractor")
            return None
        
        if isinstance(upload_folder, str):
            upload_folder = Path(upload_folder)
        
        mineru_extractor = MinerUElementExtractor(parser_service, upload_folder)
        logger.info("✅ MinerU提取器已创建")
    
    # 创建百度OCR提取器
    if baidu_ocr_extractor is None:
        try:
            from services.ai_providers.ocr import create_baidu_accurate_ocr_provider
            baidu_provider = create_baidu_accurate_ocr_provider()
            if baidu_provider is None:
                logger.warning("无法创建百度高精度OCR Provider")
                return None
            baidu_ocr_extractor = BaiduAccurateOCRElementExtractor(baidu_provider)
            logger.info("✅ 百度高精度OCR提取器已创建")
        except Exception as e:
            logger.error(f"创建百度高精度OCR提取器失败: {e}")
            return None
    
    return HybridElementExtractor(
        mineru_extractor=mineru_extractor,
        baidu_ocr_extractor=baidu_ocr_extractor,
        contain_threshold=contain_threshold,
        intersection_threshold=intersection_threshold
    )

