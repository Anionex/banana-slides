"""
掩码图像生成工具
用于从边界框（bbox）生成黑白掩码图像
"""
import logging
from typing import List, Tuple, Union, Callable
from PIL import Image, ImageDraw

logger = logging.getLogger(__name__)


# ============== Bbox 工具函数 ==============

def normalize_bbox(bbox: Union[Tuple, List, dict]) -> Tuple[int, int, int, int]:
    """
    将各种格式的bbox标准化为 (x1, y1, x2, y2) 元组格式
    
    支持的输入格式：
    - 元组/列表: (x1, y1, x2, y2)
    - 字典: {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
    - 字典: {"x": x, "y": y, "width": w, "height": h}
    """
    if isinstance(bbox, dict):
        if 'x1' in bbox:
            return (bbox['x1'], bbox['y1'], bbox['x2'], bbox['y2'])
        elif 'x' in bbox:
            return (bbox['x'], bbox['y'], 
                   bbox['x'] + bbox['width'], 
                   bbox['y'] + bbox['height'])
        else:
            raise ValueError(f"无法识别的bbox字典格式: {bbox}")
    elif isinstance(bbox, (tuple, list)) and len(bbox) == 4:
        return tuple(bbox)
    else:
        raise ValueError(f"无法识别的bbox格式: {bbox}")


def normalize_bboxes(bboxes: List[Union[Tuple, List, dict]]) -> List[Tuple[int, int, int, int]]:
    """批量标准化bbox列表"""
    result = []
    for bbox in bboxes:
        try:
            result.append(normalize_bbox(bbox))
        except ValueError as e:
            logger.warning(str(e))
    return result


def merge_two_boxes(box1: Tuple, box2: Tuple) -> Tuple[int, int, int, int]:
    """合并两个bbox为一个包含它们的最小bbox"""
    return (
        min(box1[0], box2[0]),
        min(box1[1], box2[1]),
        max(box1[2], box2[2]),
        max(box1[3], box2[3])
    )


def _iterative_merge(
    bboxes: List[Tuple[int, int, int, int]],
    should_merge_fn: Callable[[Tuple, Tuple], bool]
) -> List[Tuple[int, int, int, int]]:
    """
    通用的迭代合并算法
    
    Args:
        bboxes: 标准化后的bbox列表
        should_merge_fn: 判断两个bbox是否应该合并的函数
    
    Returns:
        合并后的bbox列表
    """
    if not bboxes:
        return []
    if len(bboxes) == 1:
        return list(bboxes)
    
    normalized = list(bboxes)
    merged = True
    
    while merged:
        merged = False
        new_boxes = []
        used = set()
        
        for i, box1 in enumerate(normalized):
            if i in used:
                continue
            
            current_box = box1
            
            for j, box2 in enumerate(normalized):
                if j <= i or j in used:
                    continue
                
                if should_merge_fn(current_box, box2):
                    current_box = merge_two_boxes(current_box, box2)
                    used.add(j)
                    merged = True
            
            new_boxes.append(current_box)
            used.add(i)
        
        normalized = new_boxes
    
    return normalized


def create_mask_from_bboxes(
    image_size: Tuple[int, int],
    bboxes: List[Union[Tuple[int, int, int, int], dict]],
    mask_color: Tuple[int, int, int] = (255, 255, 255),
    background_color: Tuple[int, int, int] = (0, 0, 0),
    expand_pixels: int = 0
) -> Image.Image:
    """
    从边界框列表创建掩码图像
    
    Args:
        image_size: 图像尺寸 (width, height)
        bboxes: 边界框列表，每个元素可以是：
                - 元组格式: (x1, y1, x2, y2) 其中 (x1,y1) 是左上角，(x2,y2) 是右下角
                - 字典格式: {"x": x, "y": y, "width": w, "height": h}
                - 字典格式: {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
        mask_color: 掩码区域的颜色（默认白色），表示需要消除的区域
        background_color: 背景区域的颜色（默认黑色），表示保留的区域
        expand_pixels: 扩展像素数，可以让掩码区域略微扩大（用于更好的消除效果）
        
    Returns:
        PIL Image 对象，RGB 模式的掩码图像
    """
    try:
        # 创建黑色背景图像
        mask = Image.new('RGB', image_size, background_color)
        draw = ImageDraw.Draw(mask)
        
        logger.info(f"创建掩码图像，尺寸: {image_size}, bbox数量: {len(bboxes)}")
        
        # 绘制每个 bbox 为白色区域
        bbox_list = []  # 用于记录所有bbox坐标
        for i, bbox in enumerate(bboxes):
            # 解析不同格式的 bbox
            if isinstance(bbox, dict):
                if 'x1' in bbox and 'y1' in bbox and 'x2' in bbox and 'y2' in bbox:
                    # 格式: {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
                    x1 = bbox['x1']
                    y1 = bbox['y1']
                    x2 = bbox['x2']
                    y2 = bbox['y2']
                elif 'x' in bbox and 'y' in bbox and 'width' in bbox and 'height' in bbox:
                    # 格式: {"x": x, "y": y, "width": w, "height": h}
                    x1 = bbox['x']
                    y1 = bbox['y']
                    x2 = x1 + bbox['width']
                    y2 = y1 + bbox['height']
                else:
                    logger.warning(f"无法识别的 bbox 字典格式: {bbox}")
                    continue
            elif isinstance(bbox, (tuple, list)) and len(bbox) == 4:
                # 格式: (x1, y1, x2, y2)
                x1, y1, x2, y2 = bbox
            else:
                logger.warning(f"无法识别的 bbox 格式: {bbox}")
                continue
            
            # 记录原始坐标
            x1_orig, y1_orig, x2_orig, y2_orig = x1, y1, x2, y2
            
            # 应用扩展或收缩
            if expand_pixels > 0:
                # 扩展
                x1 = max(0, x1 - expand_pixels)
                y1 = max(0, y1 - expand_pixels)
                x2 = min(image_size[0], x2 + expand_pixels)
                y2 = min(image_size[1], y2 + expand_pixels)
            elif expand_pixels < 0:
                # 收缩（向内收缩）
                shrink = abs(expand_pixels)
                x1 = x1 + shrink
                y1 = y1 + shrink
                x2 = x2 - shrink
                y2 = y2 - shrink
                # 确保收缩后仍然有效（宽度和高度必须大于0）
                if x2 <= x1 or y2 <= y1:
                    logger.warning(f"bbox {i+1} 收缩后无效: ({x1}, {y1}, {x2}, {y2})，跳过")
                    continue
            
            # 确保坐标在图像范围内
            x1 = max(0, min(x1, image_size[0]))
            y1 = max(0, min(y1, image_size[1]))
            x2 = max(0, min(x2, image_size[0]))
            y2 = max(0, min(y2, image_size[1]))
            
            # 再次检查有效性
            if x2 <= x1 or y2 <= y1:
                logger.warning(f"bbox {i+1} 最终坐标无效: ({x1}, {y1}, {x2}, {y2})，跳过")
                continue
            
            # 绘制矩形
            draw.rectangle([x1, y1, x2, y2], fill=mask_color)
            width = x2 - x1
            height = y2 - y1
            if expand_pixels > 0:
                bbox_list.append(f"  [{i+1}] 原始: ({x1_orig}, {y1_orig}, {x2_orig}, {y2_orig}) -> 扩展后: ({x1}, {y1}, {x2}, {y2}) 尺寸: {width}x{height}")
            elif expand_pixels < 0:
                bbox_list.append(f"  [{i+1}] 原始: ({x1_orig}, {y1_orig}, {x2_orig}, {y2_orig}) -> 收缩后: ({x1}, {y1}, {x2}, {y2}) 尺寸: {width}x{height}")
            else:
                bbox_list.append(f"  [{i+1}] ({x1}, {y1}, {x2}, {y2}) 尺寸: {width}x{height}")
            logger.debug(f"bbox {i+1}: ({x1}, {y1}, {x2}, {y2}) 尺寸: {width}x{height}")
        
        # 输出所有bbox的详细信息
        if bbox_list:
            logger.info(f"添加了 {len(bbox_list)} 个bbox的mask:")
            for bbox_info in bbox_list:
                logger.info(bbox_info)
        
        logger.info(f"掩码图像创建完成")
        return mask
        
    except Exception as e:
        logger.error(f"创建掩码图像失败: {str(e)}", exc_info=True)
        raise


def create_inverse_mask_from_bboxes(
    image_size: Tuple[int, int],
    bboxes: List[Union[Tuple[int, int, int, int], dict]],
    expand_pixels: int = 0
) -> Image.Image:
    """
    创建反向掩码（保留 bbox 区域，消除其他区域）
    
    Args:
        image_size: 图像尺寸 (width, height)
        bboxes: 边界框列表
        expand_pixels: 扩展像素数
        
    Returns:
        PIL Image 对象，反向掩码图像
    """
    # 交换颜色即可
    return create_mask_from_bboxes(
        image_size,
        bboxes,
        mask_color=(0, 0, 0),  # bbox 区域为黑色（保留）
        background_color=(255, 255, 255),  # 背景为白色（消除）
        expand_pixels=expand_pixels
    )


def create_mask_from_image_and_bboxes(
    image: Image.Image,
    bboxes: List[Union[Tuple[int, int, int, int], dict]],
    expand_pixels: int = 0
) -> Image.Image:
    """
    从图像和边界框创建掩码（便捷函数）
    
    Args:
        image: 原始图像
        bboxes: 边界框列表
        expand_pixels: 扩展像素数
        
    Returns:
        掩码图像
    """
    return create_mask_from_bboxes(
        image.size,
        bboxes,
        expand_pixels=expand_pixels
    )


def visualize_mask_overlay(
    original_image: Image.Image,
    mask_image: Image.Image,
    alpha: float = 0.5
) -> Image.Image:
    """
    将掩码叠加到原始图像上以便可视化
    
    Args:
        original_image: 原始图像
        mask_image: 掩码图像
        alpha: 掩码透明度 (0.0-1.0)
        
    Returns:
        叠加后的图像
    """
    try:
        # 确保两个图像尺寸相同
        if original_image.size != mask_image.size:
            logger.warning(f"图像尺寸不匹配，调整掩码尺寸: {mask_image.size} -> {original_image.size}")
            mask_image = mask_image.resize(original_image.size, Image.LANCZOS)
        
        # 转换为 RGBA
        if original_image.mode != 'RGBA':
            original_rgba = original_image.convert('RGBA')
        else:
            original_rgba = original_image.copy()
        
        # 创建黑色半透明掩码用于可视化
        mask_rgba = Image.new('RGBA', original_image.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(mask_rgba)
        
        # 遍历掩码图像，将白色区域绘制为黑色半透明
        mask_array = mask_image.load()
        mask_rgba_array = mask_rgba.load()
        
        for y in range(mask_image.size[1]):
            for x in range(mask_image.size[0]):
                pixel = mask_array[x, y]
                # 如果是白色（或接近白色），设置为黑色半透明
                if isinstance(pixel, tuple):
                    brightness = sum(pixel) / len(pixel)
                else:
                    brightness = pixel
                
                if brightness > 200:  # 接近白色
                    mask_rgba_array[x, y] = (0, 0, 0, int(128 * alpha))
        
        # 叠加
        result = Image.alpha_composite(original_rgba, mask_rgba)
        return result.convert('RGB')
        
    except Exception as e:
        logger.error(f"可视化掩码叠加失败: {str(e)}", exc_info=True)
        return original_image


def merge_vertical_nearby_bboxes(
    bboxes: List[Tuple[int, int, int, int]],
    vertical_gap_ratio: float = 0.8,
    horizontal_overlap_ratio: float = 0.3
) -> List[Tuple[int, int, int, int]]:
    """
    合并上下间距很小的边界框（适用于文字行合并）
    
    合并策略（基于原始bbox判断，避免雪球效应）：
    - 按y坐标排序后，先判断每对相邻原始bbox是否应该合并
    - 如果垂直间距小于平均行高的 vertical_gap_ratio 倍
    - 并且在水平方向上有至少 horizontal_overlap_ratio 的重叠
    - 则标记为可合并，最后统一执行合并
    
    Args:
        bboxes: 边界框列表 [(x1, y1, x2, y2), ...]
        vertical_gap_ratio: 垂直间距阈值，相对于平均行高的比例，默认0.8
        horizontal_overlap_ratio: 水平重叠比例阈值，默认0.3
        
    Returns:
        合并后的边界框列表
    """
    if not bboxes or len(bboxes) <= 1:
        return list(bboxes) if bboxes else []
    
    normalized = normalize_bboxes(bboxes)
    if not normalized:
        return []
    
    # 按y坐标排序（从上到下）
    normalized.sort(key=lambda b: b[1])
    
    # 计算原始bbox的平均行高
    avg_height = sum(b[3] - b[1] for b in normalized) / len(normalized)
    max_vertical_gap = avg_height * vertical_gap_ratio
    
    def get_horizontal_overlap(box1, box2):
        """计算两个bbox在水平方向的重叠比例（相对于较小的宽度）"""
        overlap_start = max(box1[0], box2[0])
        overlap_end = min(box1[2], box2[2])
        overlap = max(0, overlap_end - overlap_start)
        min_width = min(box1[2] - box1[0], box2[2] - box2[0])
        return overlap / min_width if min_width > 0 else 0
    
    def should_merge_adjacent(box1, box2):
        """判断两个相邻（按y排序）的原始bbox是否应该合并"""
        # 垂直间距 = box2的顶部 - box1的底部
        v_gap = box2[1] - box1[3]
        
        # 如果垂直间距太大，不合并
        if v_gap > max_vertical_gap:
            return False
        
        # 检查水平重叠
        h_overlap = get_horizontal_overlap(box1, box2)
        if h_overlap >= horizontal_overlap_ratio:
            return True
        
        # 没有重叠但水平距离很近也合并
        if h_overlap <= 0:
            h_gap = max(0, max(box2[0] - box1[2], box1[0] - box2[2]))
            if h_gap < avg_height:
                return True
        
        return False
    
    # 第一步：基于原始bbox判断哪些相邻对应该合并
    merge_with_next = []
    for i in range(len(normalized) - 1):
        merge_with_next.append(should_merge_adjacent(normalized[i], normalized[i + 1]))
    
    # 第二步：根据标记执行合并
    result = []
    current_box = normalized[0]
    
    for i in range(len(merge_with_next)):
        if merge_with_next[i]:
            # 和下一个合并
            current_box = merge_two_boxes(current_box, normalized[i + 1])
        else:
            # 不合并，保存当前，开始新组
            result.append(current_box)
            current_box = normalized[i + 1]
    
    # 添加最后一个
    result.append(current_box)
    
    logger.info(f"合并相邻文字行bbox：{len(bboxes)} -> {len(result)}")
    return result


def merge_overlapping_bboxes(
    bboxes: List[Tuple[int, int, int, int]],
    merge_threshold: int = 10
) -> List[Tuple[int, int, int, int]]:
    """
    合并重叠或相邻的边界框
    
    Args:
        bboxes: 边界框列表 [(x1, y1, x2, y2), ...]
        merge_threshold: 合并阈值（像素），边界框距离小于此值时会合并
        
    Returns:
        合并后的边界框列表
    """
    if not bboxes:
        return []
    
    normalized = normalize_bboxes(bboxes)
    if not normalized:
        return []
    
    def should_merge(box1, box2):
        x1, y1, x2, y2 = box1
        bx1, by1, bx2, by2 = box2
        return (x1 - merge_threshold <= bx2 and bx1 <= x2 + merge_threshold and
                y1 - merge_threshold <= by2 and by1 <= y2 + merge_threshold)
    
    result = _iterative_merge(normalized, should_merge)
    logger.info(f"合并边界框：{len(bboxes)} -> {len(result)}")
    return result

