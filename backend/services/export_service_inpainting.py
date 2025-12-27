"""
Export Service with Inpainting - 使用 inpainting 加速背景生成的导出服务扩展
"""
import os
import json
import logging
import tempfile
from typing import List, Dict, Any, Optional
from PIL import Image

logger = logging.getLogger(__name__)


class InpaintingExportHelper:
    """
    使用 inpainting 技术优化导出流程的辅助类
    """
    
    @staticmethod
    def extract_elements_from_mineru_result(
        mineru_result_dir: str, 
        page_index: int = 0,
        target_image_size: tuple = None
    ) -> List[Dict[str, Any]]:
        """
        从 MinerU 解析结果中提取页面元素的 bbox 信息（带坐标缩放）
        
        ⚠️ 已弃用：请使用 utils.coordinate_utils.extract_elements_for_mask
        保留此方法以保持向后兼容
        
        Args:
            mineru_result_dir: MinerU 解析结果目录
            page_index: 页面索引（从0开始）
            target_image_size: 目标图片尺寸 (width, height)，用于坐标缩放
            
        Returns:
            元素列表，每个元素包含 {'bbox': [x0, y0, x1, y1], 'type': 'text/image/table'}
            bbox已缩放到目标图片坐标系
        """
        try:
            from utils.coordinate_utils import extract_elements_for_mask
            
            if not target_image_size:
                logger.warning("target_image_size not provided, cannot scale coordinates")
                return []
            
            # 使用统一的坐标映射函数
            elements = extract_elements_for_mask(
                mineru_result_dir=mineru_result_dir,
                page_index=page_index,
                target_image_size=target_image_size
            )
            
            return elements
            
        except Exception as e:
            logger.error(f"Error extracting elements from MinerU result: {str(e)}", exc_info=True)
            return []
    
    @staticmethod
    def generate_clean_backgrounds_with_inpainting(
        image_paths: List[str],
        mineru_result_dir: str,
        use_inpainting: bool = True
    ) -> List[str]:
        """
        使用 inpainting 为所有页面生成干净背景
        
        Args:
            image_paths: 原始图片路径列表
            mineru_result_dir: MinerU 解析结果目录
            use_inpainting: 是否使用 inpainting（如果为False或失败则返回原图）
            
        Returns:
            干净背景图片路径列表
        """
        from services.export_service import ExportService
        
        clean_bg_paths = []
        
        for page_index, original_image_path in enumerate(image_paths):
            try:
                logger.info(f"[{page_index+1}/{len(image_paths)}] Processing background with inpainting...")
                
                # 获取图片尺寸用于坐标缩放
                from PIL import Image as PILImage
                with PILImage.open(original_image_path) as img:
                    target_image_size = img.size  # (width, height)
                
                # 从 MinerU 结果中提取该页面的元素 bbox（带坐标缩放）
                elements = InpaintingExportHelper.extract_elements_from_mineru_result(
                    mineru_result_dir,
                    page_index,
                    target_image_size=target_image_size
                )
                
                # 保存掩码图像到本地（在调用inpainting之前）
                mask_saved_path = None
                if use_inpainting and elements:
                    try:
                        from utils.mask_utils import create_mask_from_bboxes
                        from PIL import Image
                        original_img = Image.open(original_image_path)
                        bboxes = [elem['bbox'] for elem in elements]
                        
                        # 创建mask
                        mask = create_mask_from_bboxes(
                            image_size=original_img.size,
                            bboxes=bboxes,
                            expand_pixels=10
                        )
                        
                        # 保存到原图同目录
                        base_dir = os.path.dirname(original_image_path)
                        base_name = os.path.splitext(os.path.basename(original_image_path))[0]
                        mask_saved_path = os.path.join(base_dir, f"{base_name}_mask.png")
                        mask.save(mask_saved_path)
                        logger.info(f"💾 掩码图像已保存: {mask_saved_path}")
                    except Exception as e:
                        logger.warning(f"保存掩码图像失败: {str(e)}")
                
                # 使用 inpainting 生成干净背景
                clean_bg_path = ExportService.generate_clean_background_with_inpainting(
                    original_image_path=original_image_path,
                    element_bboxes=elements,
                    use_inpainting=use_inpainting
                )
                
                if clean_bg_path:
                    clean_bg_paths.append(clean_bg_path)
                    logger.info(f"[{page_index+1}/{len(image_paths)}] ✅ Clean background generated")
                else:
                    # 回退到原图
                    clean_bg_paths.append(original_image_path)
                    logger.warning(f"[{page_index+1}/{len(image_paths)}] ⚠️ Using original image")
                    
            except Exception as e:
                logger.error(f"[{page_index+1}/{len(image_paths)}] ❌ Error: {str(e)}")
                # 出错时回退到原图
                clean_bg_paths.append(original_image_path)
        
        return clean_bg_paths

