"""
掩码图像生成工具
用于从边界框（bbox）生成黑白掩码图像
"""
import logging
from typing import List, Tuple, Union
from PIL import Image, ImageDraw

logger = logging.getLogger(__name__)


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
        
        # 创建红色半透明掩码用于可视化
        mask_rgba = Image.new('RGBA', original_image.size, (255, 0, 0, 0))
        draw = ImageDraw.Draw(mask_rgba)
        
        # 遍历掩码图像，将白色区域绘制为红色半透明
        mask_array = mask_image.load()
        mask_rgba_array = mask_rgba.load()
        
        for y in range(mask_image.size[1]):
            for x in range(mask_image.size[0]):
                pixel = mask_array[x, y]
                # 如果是白色（或接近白色），设置为红色半透明
                if isinstance(pixel, tuple):
                    brightness = sum(pixel) / len(pixel)
                else:
                    brightness = pixel
                
                if brightness > 200:  # 接近白色
                    mask_rgba_array[x, y] = (255, 0, 0, int(128 * alpha))
        
        # 叠加
        result = Image.alpha_composite(original_rgba, mask_rgba)
        return result.convert('RGB')
        
    except Exception as e:
        logger.error(f"可视化掩码叠加失败: {str(e)}", exc_info=True)
        return original_image


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
    
    # 转换为标准格式
    normalized_bboxes = []
    for bbox in bboxes:
        if isinstance(bbox, dict):
            if 'x1' in bbox:
                normalized_bboxes.append((bbox['x1'], bbox['y1'], bbox['x2'], bbox['y2']))
            elif 'x' in bbox:
                normalized_bboxes.append((bbox['x'], bbox['y'], 
                                        bbox['x'] + bbox['width'], 
                                        bbox['y'] + bbox['height']))
        else:
            normalized_bboxes.append(tuple(bbox))
    
    # 简单的合并算法：反复合并重叠的框，直到没有可合并的
    merged = True
    while merged:
        merged = False
        new_bboxes = []
        used = set()
        
        for i, bbox1 in enumerate(normalized_bboxes):
            if i in used:
                continue
                
            x1, y1, x2, y2 = bbox1
            merged_any = False
            
            for j, bbox2 in enumerate(normalized_bboxes[i+1:], i+1):
                if j in used:
                    continue
                    
                bx1, by1, bx2, by2 = bbox2
                
                # 检查是否重叠或相邻
                if (x1 - merge_threshold <= bx2 and bx1 <= x2 + merge_threshold and
                    y1 - merge_threshold <= by2 and by1 <= y2 + merge_threshold):
                    # 合并
                    x1 = min(x1, bx1)
                    y1 = min(y1, by1)
                    x2 = max(x2, bx2)
                    y2 = max(y2, by2)
                    used.add(j)
                    merged_any = True
                    merged = True
            
            new_bboxes.append((x1, y1, x2, y2))
            used.add(i)
        
        normalized_bboxes = new_bboxes
    
    logger.info(f"合并边界框：{len(bboxes)} -> {len(normalized_bboxes)}")
    return normalized_bboxes

