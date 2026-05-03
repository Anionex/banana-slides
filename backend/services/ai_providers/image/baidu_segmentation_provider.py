"""
百度智能抠图 Provider
基于百度 AI 的图像分割能力，自动识别主体并返回透明背景 PNG

API文档: https://ai.baidu.com/ai-doc/IMAGEPROCESS/rm8zl3koj
"""
import logging
import base64
import io
import os
from typing import Optional

import requests
from PIL import Image
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger(__name__)


class BaiduSegmentationProvider:
    """
    百度智能抠图 Provider

    自动识别图片中的主体，返回透明背景的 RGBA PNG。
    用于把图标从原 PPT 截图中"剥离"出来，避免矩形背景框。
    """

    def __init__(self, api_key: str):
        """
        Args:
            api_key: 百度 API Key（BCEv3 格式 'bce-v3/ALTAK-...' 或 Access Token）
        """
        self.api_key = api_key
        self.api_url = "https://aip.baidubce.com/rest/2.0/image-process/v1/segment"

        if api_key.startswith('bce-v3/'):
            logger.info("✅ 初始化百度智能抠图 Provider (BCEv3 API Key)")
        else:
            logger.info("✅ 初始化百度智能抠图 Provider (Access Token)")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=1, max=5),
        retry=retry_if_exception_type((requests.exceptions.RequestException, Exception)),
        reraise=True,
    )
    def extract_subject(self, image: Image.Image) -> Optional[Image.Image]:
        """
        对图片做主体提取，返回透明背景 RGBA PNG

        Args:
            image: PIL Image 对象（任意 mode，会转 RGB 再编码）

        Returns:
            提取后的 RGBA PIL Image；若 API 未返回有效图片则返回 None
        """
        if image.mode != 'RGB':
            rgb_image = image.convert('RGB')
        else:
            rgb_image = image

        original_size = rgb_image.size
        upscaled = False

        # API 限制：短边 ≥ 128px。图标通常很小，需要先放大到 256px 短边再调用 API。
        # 提取后由调用方按原 bbox 渲染，所以放大不影响最终 PPT 上的尺寸。
        min_short_edge = 256
        if min(rgb_image.size) < min_short_edge:
            scale = min_short_edge / min(rgb_image.size)
            new_size = (max(1, int(rgb_image.width * scale)), max(1, int(rgb_image.height * scale)))
            rgb_image = rgb_image.resize(new_size, Image.Resampling.LANCZOS)
            upscaled = True
            logger.info(f"🔍 放大到 {new_size}（API 要求短边 ≥ 128px，原始 {original_size}）")

        max_size = 3000
        if max(rgb_image.size) > max_size:
            scale = max_size / max(rgb_image.size)
            new_size = (int(rgb_image.width * scale), int(rgb_image.height * scale))
            rgb_image = rgb_image.resize(new_size, Image.Resampling.LANCZOS)
            logger.info(f"✂️ 压缩到 {new_size}（API 限制长边 ≤ {max_size}px）")

        buffer = io.BytesIO()
        rgb_image.save(buffer, format='JPEG', quality=95)
        image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        }

        if self.api_key.startswith('bce-v3/'):
            headers['Authorization'] = f'Bearer {self.api_key}'
            url = self.api_url
        else:
            url = f"{self.api_url}?access_token={self.api_key}"

        payload = {
            'image': image_base64,
            'method': 'auto',
            'return_form': 'rgba',
            'refine_mask': 'true',
        }

        response = requests.post(url, headers=headers, data=payload, timeout=60)
        response.raise_for_status()
        result = response.json()

        if 'error_code' in result:
            error_code = result.get('error_code')
            error_msg = result.get('error_msg', 'Unknown error')
            logger.error(f"❌ 百度智能抠图错误: [{error_code}] {error_msg}")
            raise Exception(f"Baidu segment API error [{error_code}]: {error_msg}")

        result_b64 = result.get('image')
        if not result_b64:
            logger.error("❌ 百度智能抠图返回结果中没有图片")
            return None

        result_bytes = base64.b64decode(result_b64)
        result_image = Image.open(io.BytesIO(result_bytes))

        if result_image.mode != 'RGBA':
            result_image = result_image.convert('RGBA')

        logger.info(f"✅ 主体提取完成 ({result_image.size})")
        return result_image


def create_baidu_segmentation_provider(
    api_key: Optional[str] = None,
) -> Optional[BaiduSegmentationProvider]:
    """
    创建百度智能抠图 Provider 实例

    Args:
        api_key: 百度 API Key，未提供则从 Flask config / 环境变量读取

    Returns:
        Provider 实例；若无 key 返回 None
    """
    from config import Config

    if not api_key:
        try:
            from flask import current_app
            api_key = current_app.config.get('BAIDU_API_KEY')
        except RuntimeError:
            pass
        if not api_key:
            api_key = Config.BAIDU_API_KEY
        if not api_key:
            api_key = os.getenv('BAIDU_API_KEY')

    if not api_key:
        logger.warning("⚠️ 未配置 BAIDU_API_KEY，跳过百度智能抠图")
        return None

    return BaiduSegmentationProvider(api_key)
