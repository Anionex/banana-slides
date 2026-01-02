"""
Inpaint提供者 - 抽象不同的inpaint实现
"""
import logging
from abc import ABC, abstractmethod
from typing import List, Optional
from PIL import Image

logger = logging.getLogger(__name__)


class InpaintProvider(ABC):
    """
    Inpaint提供者抽象接口
    
    用于抽象不同的inpaint方法，支持接入多种实现：
    - 基于InpaintingService的实现（当前默认）
    - Gemini API实现
    - SD/SDXL等其他模型实现
    - 第三方API实现
    """
    
    @abstractmethod
    def inpaint_regions(
        self,
        image: Image.Image,
        bboxes: List[tuple],
        types: Optional[List[str]] = None,
        **kwargs
    ) -> Optional[Image.Image]:
        """
        对图像中指定区域进行inpaint处理
        
        Args:
            image: 原始PIL图像对象
            bboxes: 边界框列表，每个bbox格式为 (x0, y0, x1, y1)
            types: 可选的元素类型列表，与bboxes一一对应（如 'text', 'image', 'table'等）
            **kwargs: 其他由具体实现自定义的参数
        
        Returns:
            处理后的PIL图像对象，失败返回None
        """
        pass


class DefaultInpaintProvider(InpaintProvider):
    """
    基于InpaintingService的默认Inpaint提供者
    
    这是当前系统使用的实现，调用已有的InpaintingService
    """
    
    def __init__(self, inpainting_service):
        """
        初始化默认Inpaint提供者
        
        Args:
            inpainting_service: InpaintingService实例
        """
        self.inpainting_service = inpainting_service
    
    def inpaint_regions(
        self,
        image: Image.Image,
        bboxes: List[tuple],
        types: Optional[List[str]] = None,
        **kwargs
    ) -> Optional[Image.Image]:
        """
        使用InpaintingService处理inpaint
        
        支持的kwargs参数：
        - expand_pixels: int, 扩展像素数，默认10
        - merge_bboxes: bool, 是否合并bbox，默认False
        - merge_threshold: int, 合并阈值，默认20
        - save_mask_path: str, mask保存路径，可选
        - full_page_image: Image.Image, 完整页面图像（用于Gemini），可选
        - crop_box: tuple, 裁剪框 (x0, y0, x1, y1)，可选
        """
        expand_pixels = kwargs.get('expand_pixels', 10)
        merge_bboxes = kwargs.get('merge_bboxes', False)
        merge_threshold = kwargs.get('merge_threshold', 20)
        save_mask_path = kwargs.get('save_mask_path')
        full_page_image = kwargs.get('full_page_image')
        crop_box = kwargs.get('crop_box')
        
        try:
            result_img = self.inpainting_service.remove_regions_by_bboxes(
                image=image,
                bboxes=bboxes,
                expand_pixels=expand_pixels,
                merge_bboxes=merge_bboxes,
                merge_threshold=merge_threshold,
                save_mask_path=save_mask_path,
                full_page_image=full_page_image,
                crop_box=crop_box
            )
            return result_img
        except Exception as e:
            logger.error(f"DefaultInpaintProvider处理失败: {e}", exc_info=True)
            return None

