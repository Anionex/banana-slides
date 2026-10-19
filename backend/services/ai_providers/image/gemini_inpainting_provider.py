"""
Gemini Inpainting 消除服务提供者
使用 Gemini 2.5 Flash Image Preview 模型进行基于 mask 的图像编辑
"""
import logging
from services.export_control import check_export, retry_export_request, export_sleep
from typing import Optional
from PIL import Image, ImageDraw
import numpy as np
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception
from .genai_provider import GenAIImageProvider
from config import get_config

logger = logging.getLogger(__name__)


class GeminiInpaintingProvider:
    """Gemini Inpainting 消除服务（使用 Gemini 2.5 Flash）"""
    
    # DEFAULT_MODEL = "gemini-2.5-flash-image"
    DEFAULT_MODEL = "gemini-3-pro-image-preview"
    DEFAULT_PROMPT = """\
你是一个专业的图片前景元素去除专家，以极高的精度进行前景元素的去除工作。
现在用户向你提供了两张不同的图片：
1. 原始图片
2. 使用黑色矩形遮罩标注后的图片，黑色矩形区域表示要移除的前景元素，你只需要处理这些区域。

你需要根据原始图片和黑色遮罩信息，重新绘制黑色遮罩标注的区域，去除前景元素，使得这些区域无缝融入周围的画面，就好像前景元素从来没有出现过。如果一个区域被整体标注，请你将其作为一个整体进行移除，而不是只移除其内部的内容。

禁止遗漏任何一个黑色矩形标注的区域。

"""
    
    def __init__(
        self, 
        api_key: str, 
        api_base: str = None,
        model: str = None,
        timeout: int = 60
    ):
        """
        初始化 Gemini Inpainting 提供者
        
        Args:
            api_key: Google API key
            api_base: API base URL (for proxies like aihubmix)
            model: Model name to use (default: gemini-2.5-flash-image)
            timeout: API 请求超时时间（秒）
        """
        self.model = model or self.DEFAULT_MODEL
        self.timeout = timeout
        
        # 复用 GenAIImageProvider 的底层实现
        self.genai_provider = GenAIImageProvider(
            api_key=api_key,
            api_base=api_base,
            model=self.model
        )
        
        logger.info(f"✅ Gemini Inpainting Provider 初始化 (model={self.model})")
    
    @staticmethod
    def create_marked_image(original_image: Image.Image, mask_image: Image.Image) -> Image.Image:
        """
        在原图上用纯黑色框标注需要修复的区域
        
        Args:
            original_image: 原始图像
            mask_image: 掩码图像（白色=需要移除的区域）
            
        Returns:
            标注后的图像（原图 + 纯黑色矩形覆盖）
        """
        # 确保 mask 和原图尺寸一致
        if mask_image.size != original_image.size:
            mask_image = mask_image.resize(original_image.size, Image.LANCZOS)
        
        # 转换为 RGB 模式
        if original_image.mode != 'RGB':
            original_image = original_image.convert('RGB')
        if mask_image.mode != 'RGB':
            mask_image = mask_image.convert('RGB')
        
        # 创建一个副本用于标注
        marked_image = original_image.copy()
        
        # 将 mask 转换为 numpy array 以便处理
        mask_array = np.array(mask_image)
        marked_array = np.array(marked_image)
        
        # 找到白色区域（需要标注的区域）
        # 白色像素的 RGB 值都接近 255
        white_threshold = 200
        mask_regions = np.all(mask_array > white_threshold, axis=2)
        
        # 用纯黑色 (0, 0, 0) 完全覆盖标注区域
        black_overlay = np.array([0, 0, 0], dtype=np.uint8)
        marked_array[mask_regions] = black_overlay
        
        # 转回 PIL Image
        marked_image = Image.fromarray(marked_array)
        
        logger.debug(f"✅ 已创建标注图像，用纯黑色覆盖了 {np.sum(mask_regions)} 个像素")
        
        return marked_image
    
    @retry(
        retry=retry_if_exception(retry_export_request),
        sleep=export_sleep,
        before=lambda _: check_export(),
        stop=stop_after_attempt(3),  # 最多重试3次
        wait=wait_exponential(multiplier=1, min=2, max=10),  # 指数避让: 2s, 4s, 8s
        reraise=True
    )
    def inpaint_image(
        self,
        original_image: Image.Image,
        mask_image: Image.Image,
        inpaint_mode: str = "remove",
        custom_prompt: Optional[str] = None,
        full_page_image: Optional[Image.Image] = None,
        crop_box: Optional[tuple] = None
    ) -> Optional[Image.Image]:
        """
        使用 Gemini 和掩码进行图像编辑
        
        Args:
            original_image: 原始图像
            mask_image: 掩码图像（白色=消除，黑色=保留）
            inpaint_mode: 修复模式（未使用，保留兼容性）
            custom_prompt: 自定义 prompt（如果为 None 则使用默认）
            full_page_image: 完整的 PPT 页面图像（16:9），如果提供则直接使用
            crop_box: 裁剪框 (x0, y0, x1, y1)，指定从完整页面结果中裁剪的区域
            
        Returns:
            处理后的图像，失败返回 None
        """
        try:
            logger.info("🚀 开始调用 Gemini inpainting（标注模式）")
            
            working_image = full_page_image
            
            # 1. 扩展 mask 到完整页面大小
            result_crop_box = crop_box  # 保存传入的 crop_box
            
            # 直接使用完整页面图像
            final_image = working_image
            
            # 扩展 mask 到完整页面大小
            # 创建与完整页面同样大小的黑色 mask
            full_mask = Image.new('RGB', final_image.size, (0, 0, 0))
            # 将原 mask 粘贴到正确的位置
            x0, y0, x1, y1 = crop_box
            # 确保 mask 尺寸匹配
            mask_resized = mask_image.resize((x1 - x0, y1 - y0), Image.LANCZOS)
            full_mask.paste(mask_resized, (x0, y0))
            final_mask = full_mask
            logger.info(f"📷 完整页面模式: 页面={final_image.size}, mask扩展到={final_mask.size}, 粘贴位置={crop_box}")

            # 2. 创建标注图像（在原图上用纯黑色框标注需要修复的区域）
            logger.info("🎨 创建标注图像（纯黑色框标注需要移除的区域）...")
            marked_image = self.create_marked_image(final_image, final_mask)
            logger.info(f"✅ 标注图像创建完成: {marked_image.size}")
            
            # 3. 构建 prompt
            prompt = custom_prompt or self.DEFAULT_PROMPT
            logger.info(f"📝 Prompt: {prompt[:100]}...")
            
            # 4. 调用 GenAI Provider 生成图像（只传标注后的图像，不传 mask）
            logger.info("🌐 调用 GenAI Provider 进行 inpainting（仅传标注图）...")
            
            result_image = self.genai_provider.generate_image(
                prompt=prompt,
                ref_images=[full_page_image, marked_image],  
                aspect_ratio="16:9",
                resolution="1K"
            )
            
            if result_image is None:
                logger.error("❌ Gemini Inpainting 失败：未返回图像")
                return None
            
            # 5. 转换为 PIL Image（如果需要）
            # GenAI SDK 返回的是 google.genai.types.Image 对象，需要转换为 PIL Image
            if hasattr(result_image, '_pil_image'):
                logger.debug("🔄 转换 GenAI Image 为 PIL Image")
                result_image = result_image._pil_image
            
            logger.info(f"✅ Gemini Inpainting 成功！API返回尺寸: {result_image.size}, {result_image.mode}")
            
            # 6. Resize 到原图尺寸
            if result_image.size != final_image.size:
                logger.info(f"🔄 Resize 从 {result_image.size} 到 {final_image.size}")
                result_image = result_image.resize(final_image.size, Image.LANCZOS)
            
            # 7. 合成图像：只在mask区域使用inpaint结果，其他区域保留原图
            logger.info("🎨 合成图像：将inpaint结果与原图按mask合并...")
            
            # 确保所有图像都是RGB模式
            if result_image.mode != 'RGB':
                result_image = result_image.convert('RGB')
            if final_image.mode != 'RGB':
                final_image = final_image.convert('RGB')
            
            # 将mask转换为灰度图（L模式）
            mask_for_composite = final_mask.convert('L')
            
            # 使用PIL的composite方法合成
            # mask中白色(255)区域使用inpainting结果，黑色(0)区域使用原图
            composited_image = Image.composite(result_image, final_image, mask_for_composite)
            logger.info(f"✅ 图像合成完成！尺寸: {composited_image.size}")
            
            # 8. 裁剪回目标尺寸
            cropped_result = composited_image.crop(result_crop_box)
            logger.info(f"✂️  从完整页面裁剪: {composited_image.size} -> {cropped_result.size}")
            return cropped_result
            
        except Exception as e:
            logger.error(f"❌ Gemini Inpainting 失败: {e}", exc_info=True)
            raise
