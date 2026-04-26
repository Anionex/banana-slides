"""
Anthropic-compatible image generation provider

Note: Anthropic Claude models don't natively support image generation yet.
This provider is designed for Anthropic-compatible endpoints that support
image generation (e.g., third-party proxy services).
"""
import logging
import base64
import re
import requests
from io import BytesIO
from typing import Optional, List
from PIL import Image
from .base import ImageProvider
from config import get_config

logger = logging.getLogger(__name__)

try:
    from anthropic import Anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    logger.warning("Anthropic SDK not available, image generation may not work")


class AnthropicImageProvider(ImageProvider):
    """
    Image generation using Anthropic-compatible API

    This provider uses an OpenAI-compatible client approach for
    Anthropic-compatible endpoints that support image generation.
    """

    def __init__(self, api_key: str, api_base: str = None, model: str = "claude-3-5-sonnet-20241022"):
        """
        Initialize Anthropic image provider

        Args:
            api_key: API key
            api_base: API base URL
            model: Model name to use
        """
        self.api_key = api_key
        self.api_base = api_base or "https://api.anthropic.com"
        self.model = model
        self.timeout = get_config().OPENAI_TIMEOUT
        self.max_retries = get_config().OPENAI_MAX_RETRIES

    def _encode_image_to_base64(self, image: Image.Image) -> str:
        """Encode PIL Image to base64 string"""
        buffered = BytesIO()
        if image.mode in ('RGBA', 'LA', 'P'):
            image = image.convert('RGB')
        image.save(buffered, format="JPEG", quality=95)
        return base64.b64encode(buffered.getvalue()).decode('utf-8')

    def generate_image(
        self,
        prompt: str,
        ref_images: Optional[List[Image.Image]] = None,
        aspect_ratio: str = "16:9",
        resolution: str = "2K",
        enable_thinking: bool = False,
        thinking_budget: int = 0
    ) -> Optional[Image.Image]:
        """
        Generate image using Anthropic-compatible API

        Note: This is for third-party Anthropic-compatible endpoints that
        support image generation. Official Anthropic API doesn't support
        image generation yet.

        Args:
            prompt: The image generation prompt
            ref_images: Optional list of reference images
            aspect_ratio: Image aspect ratio
            resolution: Image resolution
            enable_thinking: Ignored
            thinking_budget: Ignored

        Returns:
            Generated PIL Image object, or None if failed
        """
        try:
            logger.warning(
                "AnthropicImageProvider: Official Anthropic API doesn't support image generation. "
                "This provider is intended for use with third-party compatible endpoints only."
            )

            # Build message content
            content = []

            # Add reference images first (if any)
            if ref_images:
                for ref_img in ref_images:
                    base64_image = self._encode_image_to_base64(ref_img)
                    content.append({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": base64_image
                        }
                    })

            # Add text prompt
            content.append({"type": "text", "text": prompt})

            logger.debug(f"Calling Anthropic-compatible API for image generation...")
            logger.debug(f"Config - aspect_ratio: {aspect_ratio}, resolution: {resolution}")

            # First try: Use requests to call a compatible endpoint that supports image generation
            # This is a fallback approach for endpoints that use OpenAI-like format
            try:
                return self._try_openai_compatible_format(
                    content, prompt, aspect_ratio, resolution, ref_images
                )
            except Exception as e:
                logger.debug(f"OpenAI-compatible format failed: {e}, trying direct approach")

            raise NotImplementedError(
                "Official Anthropic API doesn't support image generation yet. "
                "Please use a different provider (gemini/openai) for image generation, "
                "or use a third-party Anthropic-compatible endpoint that supports image generation."
            )

        except Exception as e:
            error_detail = f"Error generating image with Anthropic (model={self.model}): {type(e).__name__}: {str(e)}"
            logger.error(error_detail, exc_info=True)
            raise Exception(error_detail) from e

    def _try_openai_compatible_format(
        self,
        content: list,
        prompt: str,
        aspect_ratio: str,
        resolution: str,
        ref_images: Optional[List[Image.Image]]
    ) -> Optional[Image.Image]:
        """Try using OpenAI-compatible client approach for image generation"""
        try:
            from openai import OpenAI
        except ImportError:
            raise Exception("OpenAI SDK is required for Anthropic-compatible image generation")

        client = OpenAI(
            api_key=self.api_key,
            base_url=self.api_base,
            timeout=self.timeout,
            max_retries=self.max_retries
        )

        # Build content in OpenAI format
        openai_content = []
        if ref_images:
            for ref_img in ref_images:
                base64_image = self._encode_image_to_base64(ref_img)
                openai_content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                })
        openai_content.append({"type": "text", "text": prompt})

        extra_body = {
            "aspect_ratio": aspect_ratio,
            "resolution": resolution.upper(),
            "generationConfig": {
                "imageConfig": {
                    "aspectRatio": aspect_ratio,
                    "imageSize": resolution.upper(),
                }
            }
        }

        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": f"aspect_ratio={aspect_ratio}, resolution={resolution}"},
                {"role": "user", "content": openai_content},
            ],
            modalities=["text", "image"],
            extra_body=extra_body
        )

        # Extract image from response using same logic as OpenAIImageProvider
        message = response.choices[0].message

        if hasattr(message, 'multi_mod_content') and message.multi_mod_content:
            parts = message.multi_mod_content
            for part in parts:
                if "inline_data" in part:
                    image_data = base64.b64decode(part["inline_data"]["data"])
                    return Image.open(BytesIO(image_data))

        if hasattr(message, 'content') and message.content:
            if isinstance(message.content, list):
                for part in message.content:
                    if isinstance(part, dict):
                        if part.get('type') == 'image_url':
                            image_url = part.get('image_url', {}).get('url', '')
                            if image_url.startswith('data:image'):
                                base64_data = image_url.split(',', 1)[1]
                                return Image.open(BytesIO(base64.b64decode(base64_data)))
                    elif hasattr(part, 'type') and part.type == 'image_url':
                        image_url = getattr(part, 'image_url', {})
                        url = image_url.get('url', '') if isinstance(image_url, dict) else getattr(image_url, 'url', '')
                        if url.startswith('data:image'):
                            return Image.open(BytesIO(base64.b64decode(url.split(',', 1)[1])))

            elif isinstance(message.content, str):
                content_str = message.content
                base64_pattern = r'data:image/[^;]+;base64,([A-Za-z0-9+/=]+)'
                base64_matches = re.findall(base64_pattern, content_str)
                if base64_matches:
                    return Image.open(BytesIO(base64.b64decode(base64_matches[0])))

                url_pattern = r'(https?://[^\s\)\]]+\.(?:png|jpg|jpeg|gif|webp|bmp)(?:\?[^\s\)\]]*)?)'
                url_matches = re.findall(url_pattern, content_str, re.IGNORECASE)
                if url_matches:
                    resp = requests.get(url_matches[0], timeout=30, stream=True)
                    resp.raise_for_status()
                    return Image.open(BytesIO(resp.content))

        raise ValueError("No image found in response")
