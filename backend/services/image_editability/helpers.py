"""
辅助函数和工具方法

纯函数，不依赖任何具体实现
"""
import logging
import tempfile
from typing import List
from PIL import Image

from .data_models import EditableElement, BBox

logger = logging.getLogger(__name__)


def collect_bboxes_from_elements(elements: List[EditableElement]) -> List[tuple]:
    """
    收集当前层级元素的bbox列表（不递归到子元素）
    
    Args:
        elements: 元素列表
        
    Returns:
        bbox元组列表 [(x0, y0, x1, y1), ...]
    """
    bboxes = []
    for elem in elements:
        bbox_tuple = elem.bbox.to_tuple()
        bboxes.append(bbox_tuple)
        logger.debug(f"元素 {elem.element_id} ({elem.element_type}): bbox={bbox_tuple}")
    return bboxes


def crop_element_from_image(
    source_image_path: str,
    bbox: BBox
) -> str:
    """
    从源图片中裁剪出元素区域
    
    Args:
        source_image_path: 源图片路径
        bbox: 裁剪区域
        
    Returns:
        裁剪后图片的临时文件路径
    """
    img = Image.open(source_image_path)
    
    # 裁剪
    crop_box = (int(bbox.x0), int(bbox.y0), int(bbox.x1), int(bbox.y1))
    cropped = img.crop(crop_box)
    
    # 保存到临时文件
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        cropped.save(tmp.name)
        return tmp.name


def should_recurse_into_element(
    element: EditableElement,
    parent_image_size: tuple,
    min_image_size: int,
    min_image_area: int,
    max_child_coverage_ratio: float
) -> bool:
    """
    判断是否应该对元素进行递归分析
    
    Args:
        element: 待判断的元素
        parent_image_size: 父图尺寸 (width, height)
        min_image_size: 最小图片尺寸
        min_image_area: 最小图片面积
        max_child_coverage_ratio: 最大子图覆盖比例
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
    if bbox.width < min_image_size or bbox.height < min_image_size:
        logger.debug(f"  元素 {element.element_id} 尺寸过小 ({bbox.width}x{bbox.height})，不递归")
        return False
    
    if bbox.area < min_image_area:
        logger.debug(f"  元素 {element.element_id} 面积过小 ({bbox.area})，不递归")
        return False
    
    # 检查子图是否占据父图绝大部分面积
    parent_width, parent_height = parent_image_size
    parent_area = parent_width * parent_height
    coverage_ratio = bbox.area / parent_area if parent_area > 0 else 0
    
    if coverage_ratio > max_child_coverage_ratio:
        logger.info(f"  元素 {element.element_id} 占父图面积 {coverage_ratio*100:.1f}% (>{max_child_coverage_ratio*100:.0f}%)，不递归")
        return False
    
    return True
