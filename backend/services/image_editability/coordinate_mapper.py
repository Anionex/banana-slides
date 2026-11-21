"""
坐标映射工具 - 处理父子图片间的坐标转换
"""
from typing import Tuple
from .data_models import BBox


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

