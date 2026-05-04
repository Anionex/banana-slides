"""
辅助函数和工具方法

纯函数，不依赖任何具体实现
"""
import logging
import tempfile
from typing import List, Optional
import numpy as np
import cv2
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


def should_extract_subject(
    slide_image_bgr: np.ndarray,
    bbox: BBox,
    ring_width: int = 5,
    color_tolerance: int = 20,
    rect_area_threshold: float = 0.70,
) -> Optional[bool]:
    """
    判断 ROI 是否为"图标"（值得送入主体抠图模型）还是"照片"（保持原矩形 crop）。

    用环形采样 + flood fill 在 ROI 内识别"渗入的幻灯片背景"，剩下的视为主体掩码：
      - 主体最大轮廓近似为 4 顶点 AND 面积占 ROI ≥ rect_area_threshold → 照片 (False)
      - 否则视为图标 (True)
      - 检测条件不满足（贴边 / 太小 / 没匹配到背景 seed / 全是背景色）→ None

    返回:
        True  - 图标，应送入主体抠图模型
        False - 照片，保留原矩形 crop
        None  - 不确定，保留原矩形 crop
    """
    if slide_image_bgr is None or slide_image_bgr.size == 0:
        return None

    page_h, page_w = slide_image_bgr.shape[:2]
    x0 = max(0, int(bbox.x0))
    y0 = max(0, int(bbox.y0))
    x1 = min(page_w, int(bbox.x1))
    y1 = min(page_h, int(bbox.y1))
    if x1 - x0 < 8 or y1 - y0 < 8:
        return None

    rx0 = max(0, x0 - ring_width)
    ry0 = max(0, y0 - ring_width)
    rx1 = min(page_w, x1 + ring_width)
    ry1 = min(page_h, y1 + ring_width)
    if rx0 == x0 and ry0 == y0 and rx1 == x1 and ry1 == y1:
        return None

    ring = slide_image_bgr[ry0:ry1, rx0:rx1]
    ring_mask = np.ones(ring.shape[:2], dtype=bool)
    ring_mask[(y0 - ry0):(y1 - ry0), (x0 - rx0):(x1 - rx0)] = False
    ring_pixels = ring[ring_mask]
    if len(ring_pixels) < 16:
        return None
    bg_color = np.median(ring_pixels, axis=0)

    roi = slide_image_bgr[y0:y1, x0:x1].copy()
    rh, rw = roi.shape[:2]

    border_step = max(1, min(rh, rw) // 32)
    seeds: list[tuple[int, int]] = []
    for x in range(0, rw, border_step):
        seeds.append((x, 0))
        seeds.append((x, rh - 1))
    for y in range(0, rh, border_step):
        seeds.append((0, y))
        seeds.append((rw - 1, y))

    bg_int = bg_color.astype(np.int16)
    matched_seeds: list[tuple[int, int]] = []
    for sx, sy in seeds:
        diff = np.abs(roi[sy, sx].astype(np.int16) - bg_int).max()
        if diff <= color_tolerance:
            matched_seeds.append((sx, sy))

    if not matched_seeds:
        return None

    flood_mask = np.zeros((rh + 2, rw + 2), dtype=np.uint8)
    diff = (color_tolerance, color_tolerance, color_tolerance)
    flood_flags = 4 | (1 << 8) | cv2.FLOODFILL_MASK_ONLY
    for sx, sy in matched_seeds:
        if flood_mask[sy + 1, sx + 1] == 0:
            cv2.floodFill(
                roi, flood_mask, (sx, sy), newVal=0,
                loDiff=diff, upDiff=diff, flags=flood_flags,
            )

    bg_mask = flood_mask[1:-1, 1:-1]
    subject_mask = np.where(bg_mask == 0, 255, 0).astype(np.uint8)

    roi_area = rh * rw
    subject_area = int(np.count_nonzero(subject_mask))
    if subject_area == 0 or subject_area < roi_area * 0.05:
        return None

    contours, _ = cv2.findContours(subject_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    main_contour = max(contours, key=cv2.contourArea)
    main_area = cv2.contourArea(main_contour)
    if main_area <= 0:
        return None

    perimeter = cv2.arcLength(main_contour, True)
    epsilon = 0.02 * perimeter
    approx = cv2.approxPolyDP(main_contour, epsilon, True)
    if len(approx) == 4 and (main_area / roi_area) >= rect_area_threshold:
        return False

    return True


def load_slide_bgr(slide_image_path: str) -> Optional[np.ndarray]:
    """加载幻灯片图片为 OpenCV BGR ndarray，失败返回 None。"""
    try:
        with Image.open(slide_image_path) as img:
            rgb = img.convert("RGB")
            arr = np.array(rgb)
        return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    except Exception as e:
        logger.warning(f"加载幻灯片图像失败: {slide_image_path}: {e}")
        return None
