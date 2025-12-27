"""
Inpainting 服务
提供基于火山引擎的图像区域消除和背景重新生成功能
"""
import logging
from typing import List, Tuple, Union, Optional
from PIL import Image

from services.ai_providers.image.volcengine_inpainting_provider import VolcengineInpaintingProvider
from utils.mask_utils import (
    create_mask_from_bboxes,
    create_inverse_mask_from_bboxes,
    create_mask_from_image_and_bboxes,
    merge_overlapping_bboxes,
    visualize_mask_overlay
)
from config import get_config

logger = logging.getLogger(__name__)


class InpaintingService:
    """
    Inpainting 服务类
    
    主要功能：
    1. 从 bbox 生成掩码图像
    2. 调用火山引擎 inpainting 服务消除指定区域
    3. 提供便捷的背景重生成接口
    """
    
    def __init__(self, volcengine_provider: Optional[VolcengineInpaintingProvider] = None):
        """
        初始化 Inpainting 服务
        
        Args:
            volcengine_provider: 火山引擎 inpainting 提供者，如果为 None 则从配置创建
        """
        if volcengine_provider is None:
            config = get_config()
            access_key = config.VOLCENGINE_ACCESS_KEY
            secret_key = config.VOLCENGINE_SECRET_KEY
            timeout = config.VOLCENGINE_INPAINTING_TIMEOUT
            
            if not access_key or not secret_key:
                raise ValueError("火山引擎 Access Key 和 Secret Key 未配置")
            
            self.provider = VolcengineInpaintingProvider(
                access_key=access_key,
                secret_key=secret_key,
                timeout=timeout
            )
        else:
            self.provider = volcengine_provider
        
        self.config = get_config()
    
    def remove_regions_by_bboxes(
        self,
        image: Image.Image,
        bboxes: List[Union[Tuple[int, int, int, int], dict]],
        expand_pixels: int = 5,
        merge_bboxes: bool = False,
        merge_threshold: int = 10,
        use_retry: bool = True,
        save_mask_path: Optional[str] = None
    ) -> Optional[Image.Image]:
        """
        根据边界框列表消除图像中的指定区域
        
        Args:
            image: 原始图像（PIL Image）
            bboxes: 边界框列表，支持以下格式：
                    - (x1, y1, x2, y2) 元组
                    - {"x1": x1, "y1": y1, "x2": x2, "y2": y2} 字典
                    - {"x": x, "y": y, "width": w, "height": h} 字典
            expand_pixels: 扩展像素数，让掩码区域略微扩大（默认5像素）
            merge_bboxes: 是否合并重叠或相邻的边界框（默认False）
            merge_threshold: 合并阈值，边界框距离小于此值时会合并（默认10像素）
            use_retry: 是否使用重试机制（默认True）
            
        Returns:
            处理后的图像，失败返回 None
        """
        try:
            logger.info(f"开始处理图像消除，原始 bbox 数量: {len(bboxes)}")
            
            # 合并重叠的边界框（如果启用）
            if merge_bboxes and len(bboxes) > 1:
                # 先标准化所有 bbox 格式
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
                
                bboxes = merge_overlapping_bboxes(normalized_bboxes, merge_threshold)
                logger.info(f"合并后 bbox 数量: {len(bboxes)}")
            
            # 生成掩码图像
            mask = create_mask_from_image_and_bboxes(
                image,
                bboxes,
                expand_pixels=expand_pixels
            )
            
            logger.info(f"掩码图像已生成，尺寸: {mask.size}")
            
            # 保存mask图像（如果指定了路径）
            if save_mask_path:
                try:
                    mask.save(save_mask_path)
                    logger.info(f"📷 Mask图像已保存: {save_mask_path}")
                except Exception as e:
                    logger.warning(f"⚠️ 保存mask图像失败: {e}")
            
            # 调用火山引擎 inpainting 服务
            if use_retry:
                result = self.provider.inpaint_with_retry(
                    original_image=image,
                    mask_image=mask,
                    max_retries=self.config.VOLCENGINE_INPAINTING_MAX_RETRIES
                )
            else:
                result = self.provider.inpaint_image(
                    original_image=image,
                    mask_image=mask
                )
            
            if result is not None:
                logger.info(f"图像消除成功，结果尺寸: {result.size}")
            else:
                logger.error("图像消除失败")
            
            return result
            
        except Exception as e:
            logger.error(f"消除区域失败: {str(e)}", exc_info=True)
            return None
    
    def regenerate_background(
        self,
        image: Image.Image,
        foreground_bboxes: List[Union[Tuple[int, int, int, int], dict]],
        expand_pixels: int = 5
    ) -> Optional[Image.Image]:
        """
        重新生成背景（保留前景对象，消除其他区域）
        
        这个方法使用反向掩码：保留 bbox 区域，消除其他所有区域
        
        Args:
            image: 原始图像
            foreground_bboxes: 前景对象的边界框列表（这些区域会被保留）
            expand_pixels: 收缩像素数（负数表示扩展），让前景边缘更自然
            
        Returns:
            处理后的图像，失败返回 None
        """
        try:
            logger.info(f"开始重新生成背景，前景对象数量: {len(foreground_bboxes)}")
            
            # 生成反向掩码（保留前景，消除背景）
            mask = create_inverse_mask_from_bboxes(
                image.size,
                foreground_bboxes,
                expand_pixels=expand_pixels
            )
            
            logger.info(f"反向掩码已生成，尺寸: {mask.size}")
            
            # 调用火山引擎 inpainting 服务
            result = self.provider.inpaint_with_retry(
                original_image=image,
                mask_image=mask,
                max_retries=self.config.VOLCENGINE_INPAINTING_MAX_RETRIES
            )
            
            if result is not None:
                logger.info(f"背景重生成成功，结果尺寸: {result.size}")
            else:
                logger.error("背景重生成失败")
            
            return result
            
        except Exception as e:
            logger.error(f"重新生成背景失败: {str(e)}", exc_info=True)
            return None
    
    def create_mask_preview(
        self,
        image: Image.Image,
        bboxes: List[Union[Tuple[int, int, int, int], dict]],
        expand_pixels: int = 0,
        alpha: float = 0.5
    ) -> Image.Image:
        """
        创建掩码预览图（用于调试和可视化）
        
        Args:
            image: 原始图像
            bboxes: 边界框列表
            expand_pixels: 扩展像素数
            alpha: 掩码透明度
            
        Returns:
            叠加了红色半透明掩码的预览图
        """
        mask = create_mask_from_image_and_bboxes(image, bboxes, expand_pixels)
        return visualize_mask_overlay(image, mask, alpha)
    
    @staticmethod
    def create_mask_image(
        image_size: Tuple[int, int],
        bboxes: List[Union[Tuple[int, int, int, int], dict]],
        expand_pixels: int = 0
    ) -> Image.Image:
        """
        静态方法：创建掩码图像（不需要实例化服务）
        
        Args:
            image_size: 图像尺寸 (width, height)
            bboxes: 边界框列表
            expand_pixels: 扩展像素数
            
        Returns:
            掩码图像
        """
        return create_mask_from_bboxes(image_size, bboxes, expand_pixels)


# 便捷函数

def get_inpainting_service() -> InpaintingService:
    """
    获取 InpaintingService 实例（单例模式）
    
    Returns:
        InpaintingService 实例
    """
    global _inpainting_service_instance
    
    if '_inpainting_service_instance' not in globals():
        _inpainting_service_instance = InpaintingService()
    
    return _inpainting_service_instance


def remove_regions(
    image: Image.Image,
    bboxes: List[Union[Tuple[int, int, int, int], dict]],
    **kwargs
) -> Optional[Image.Image]:
    """
    便捷函数：消除图像中的指定区域
    
    Args:
        image: 原始图像
        bboxes: 边界框列表
        **kwargs: 其他参数传递给 InpaintingService.remove_regions_by_bboxes
        
    Returns:
        处理后的图像
    """
    service = get_inpainting_service()
    return service.remove_regions_by_bboxes(image, bboxes, **kwargs)


def regenerate_background(
    image: Image.Image,
    foreground_bboxes: List[Union[Tuple[int, int, int, int], dict]],
    **kwargs
) -> Optional[Image.Image]:
    """
    便捷函数：重新生成背景
    
    Args:
        image: 原始图像
        foreground_bboxes: 前景对象的边界框列表
        **kwargs: 其他参数传递给 InpaintingService.regenerate_background
        
    Returns:
        处理后的图像
    """
    service = get_inpainting_service()
    return service.regenerate_background(image, foreground_bboxes, **kwargs)

