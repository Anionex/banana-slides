"""
Gemini Inpainting 消除服务提供者
使用 Gemini 2.5 Flash Image Preview 模型进行基于 mask 的图像编辑
"""
import logging
from typing import Optional
from PIL import Image
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential
from config import get_config

logger = logging.getLogger(__name__)


class GeminiInpaintingProvider:
    """Gemini Inpainting 消除服务（使用 Gemini 2.5 Flash）"""
    
    DEFAULT_MODEL = "gemini-2.5-flash-image-preview"
    DEFAULT_PROMPT = (
        "Based on the original image and the mask (white areas indicate regions to remove), "
        "please remove all text and graphic content within the masked regions to create a clean background. "
        "The resulting background should maintain the same style and be visually consistent with the original image. "
        "Keep the layout structure unchanged."
    )
    
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
            model: Model name to use (default: gemini-2.5-flash-image-preview)
            timeout: API 请求超时时间（秒）
        """
        self.api_key = api_key
        self.api_base = api_base
        self.model = model or self.DEFAULT_MODEL
        self.timeout = timeout
        
        timeout_ms = int(timeout * 1000)
        
        # 构建 HttpOptions
        http_options = types.HttpOptions(
            base_url=api_base,
            timeout=timeout_ms
        ) if api_base else types.HttpOptions(timeout=timeout_ms)
        
        self.client = genai.Client(
            http_options=http_options,
            api_key=api_key
        )
        
        logger.info(f"✅ Gemini Inpainting Provider 初始化 (model={self.model})")
    
    def _expand_to_16_9(self, image: Image.Image, fill_color=(255, 255, 255)) -> tuple[Image.Image, tuple[int, int, int, int]]:
        """
        将图像扩展到 16:9 比例（Gemini 要求标准比例）
        
        Args:
            image: 原始图像
            fill_color: 填充颜色（默认白色）
            
        Returns:
            (扩展后的图像, 原图在扩展图中的位置 (x0, y0, x1, y1))
        """
        original_width, original_height = image.size
        
        # 计算16:9比例下的目标尺寸
        target_ratio = 16 / 9
        current_ratio = original_width / original_height
        
        if abs(current_ratio - target_ratio) < 0.01:
            # 已经是16:9，不需要扩展
            return image, (0, 0, original_width, original_height)
        
        if current_ratio > target_ratio:
            # 宽度足够，需要增加高度
            target_width = original_width
            target_height = int(original_width / target_ratio)
        else:
            # 高度足够，需要增加宽度
            target_height = original_height
            target_width = int(original_height * target_ratio)
        
        # 创建16:9画布
        expanded = Image.new('RGB', (target_width, target_height), fill_color)
        
        # 将原图居中粘贴
        x_offset = (target_width - original_width) // 2
        y_offset = (target_height - original_height) // 2
        expanded.paste(image, (x_offset, y_offset))
        
        # 返回扩展后的图像和原图位置
        crop_box = (x_offset, y_offset, x_offset + original_width, y_offset + original_height)
        
        logger.info(f"📐 扩展图像: {original_width}x{original_height} -> {target_width}x{target_height} (16:9)")
        logger.info(f"   原图位置: {crop_box}")
        
        return expanded, crop_box
    
    @retry(
        stop=stop_after_attempt(3),  # 最多重试3次
        wait=wait_exponential(multiplier=1, min=2, max=10),  # 指数避让: 2s, 4s, 8s
        reraise=True
    )
    def inpaint_image(
        self,
        original_image: Image.Image,
        mask_image: Image.Image,
        inpaint_mode: str = "remove",
        custom_prompt: Optional[str] = None
    ) -> Optional[Image.Image]:
        """
        使用 Gemini 和掩码进行图像编辑
        
        Args:
            original_image: 原始图像
            mask_image: 掩码图像（白色=消除，黑色=保留）
            inpaint_mode: 修复模式（未使用，保留兼容性）
            custom_prompt: 自定义 prompt（如果为 None 则使用默认）
            
        Returns:
            处理后的图像，失败返回 None
        """
        try:
            logger.info("🚀 开始调用 Gemini inpainting")
            
            # 保存原始尺寸
            original_size = original_image.size
            
            # 1. 转换图像格式
            # 原图转换为 RGB
            if original_image.mode in ('RGBA', 'LA', 'P'):
                if original_image.mode == 'RGBA':
                    background = Image.new('RGB', original_image.size, (255, 255, 255))
                    background.paste(original_image, mask=original_image.split()[3])
                    original_image = background
                else:
                    original_image = original_image.convert('RGB')
            
            # Mask 转换为 RGB（Gemini 需要）
            # 注意：Gemini 的 mask 约定可能与火山引擎不同
            # 火山：黑色=保留，白色=消除
            # Gemini：需要测试，可能需要反转
            if mask_image.mode != 'RGB':
                # 转换灰度图为RGB
                mask_rgb = Image.new('RGB', mask_image.size)
                if mask_image.mode == 'L':
                    mask_rgb = Image.merge('RGB', (mask_image, mask_image, mask_image))
                else:
                    mask_rgb = mask_image.convert('RGB')
                mask_image = mask_rgb
            
            # 2. 扩展到 16:9 比例（Gemini 要求）
            expanded_original, crop_box = self._expand_to_16_9(original_image, fill_color=(255, 255, 255))
            expanded_mask, _ = self._expand_to_16_9(mask_image, fill_color=(0, 0, 0))  # mask用黑色填充
            
            logger.info(f"📷 图像尺寸: 原图={original_size}, 扩展后={expanded_original.size}")
            
            # 3. 构建 prompt
            prompt = custom_prompt or self.DEFAULT_PROMPT
            logger.info(f"📝 Prompt: {prompt[:100]}...")
            
            # 4. 构建请求内容
            # 根据 Gemini 文档，image editing 需要同时提供原图和 mask
            # 直接传递 PIL Image 对象和文本，SDK 会自动处理
            contents = [
                expanded_original,
                expanded_mask,
                prompt
            ]
            
            logger.info("🌐 发送请求到 Gemini API (stream)...")
            
            # 5. 调用 Gemini API (使用 stream)
            generate_content_config = types.GenerateContentConfig(
                response_modalities=['IMAGE', 'TEXT'],
                image_config=types.ImageConfig(
                    aspect_ratio="16:9",  # 使用16:9比例
                ),
            )
            
            # 6. 提取生成的图像并裁剪回原始尺寸
            from io import BytesIO
            
            for chunk in self.client.models.generate_content_stream(
                model=self.model,
                contents=contents,
                config=generate_content_config,
            ):
                # 检查是否有有效的候选响应
                if (
                    chunk.candidates is None
                    or chunk.candidates[0].content is None
                    or chunk.candidates[0].content.parts is None
                ):
                    continue
                
                # 检查是否有图像数据
                part = chunk.candidates[0].content.parts[0]
                if part.inline_data and part.inline_data.data:
                    logger.debug("✅ 找到图像数据")
                    try:
                        # 从 inline_data.data 读取图像
                        image_data = part.inline_data.data
                        result_image = Image.open(BytesIO(image_data))
                        logger.info(f"✅ Gemini Inpainting 成功！扩展图尺寸: {result_image.size}, {result_image.mode}")
                        
                        # 裁剪回原始尺寸
                        cropped_result = result_image.crop(crop_box)
                        logger.info(f"✂️  裁剪回原始尺寸: {cropped_result.size}")
                        
                        return cropped_result
                    except Exception as e:
                        logger.error(f"解析图像数据失败: {e}")
                        continue
                elif chunk.text:
                    logger.debug(f"收到文本: {chunk.text[:100]}")
            
            logger.error("❌ 响应中未找到图像")
            return None
            
        except Exception as e:
            logger.error(f"❌ Gemini Inpainting 失败: {e}", exc_info=True)
            raise
    
    def inpaint_with_retry(
        self,
        original_image: Image.Image,
        mask_image: Image.Image,
        max_retries: int = 2,
        retry_delay: int = 1
    ) -> Optional[Image.Image]:
        """
        带重试的 inpaint 调用
        
        Args:
            original_image: 原始图像
            mask_image: 掩码图像
            max_retries: 最大重试次数
            retry_delay: 重试延迟（秒）
            
        Returns:
            处理后的图像，失败返回 None
        """
        import time
        
        for attempt in range(max_retries):
            try:
                result = self.inpaint_image(original_image, mask_image)
                if result is not None:
                    return result
                    
                if attempt < max_retries - 1:
                    logger.warning(f"⚠️ 第{attempt + 1}次失败，{retry_delay}秒后重试...")
                    time.sleep(retry_delay)
                    
            except Exception as e:
                logger.error(f"第{attempt + 1}次出错: {str(e)}")
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
        
        logger.error(f"❌ {max_retries}次尝试全部失败")
        return None


