"""
OpenAI SDK implementation for image generation

Two code paths:
1. Native images API (gpt-image-2, dall-e-3, dall-e-2): uses client.images.generate /
   client.images.edit, returns b64_json directly.
2. Chat completions path (Gemini-via-proxy, etc.): uses client.chat.completions.create
   with modalities=["text","image"] and extra_body resolution hints.

Resolution validation is handled at the task_manager level for all providers.
"""
import logging
import base64
import re
import requests
from io import BytesIO
from typing import Optional, List
from openai import OpenAI
from PIL import Image
from .base import ImageProvider
from config import get_config

logger = logging.getLogger(__name__)


# Models that use the native OpenAI images API (images.generate / images.edit)
# rather than the chat completions multimodal path.
_GPT_IMAGE_MODELS = {'gpt-image-1', 'gpt-image-1.5', 'gpt-image-2'}
_DALLE_MODELS = {'dall-e-2', 'dall-e-3'}
_NATIVE_IMAGES_API_MODELS = _GPT_IMAGE_MODELS | _DALLE_MODELS

# Aspect-ratio → size per model family.
# DALL-E models only support fixed sizes; gpt-image-* uses dynamic calculation.
_DALLE3_SIZE_MAP = {
    '16:9': '1792x1024',
    '9:16': '1024x1792',
    '1:1':  '1024x1024',
    '3:2':  '1792x1024',
    '2:3':  '1024x1792',
}
_DALLE2_SIZE_MAP = {
    '1:1':  '1024x1024',
}

_RESOLUTION_LONG_EDGE = {
    '1K': 1280,
    '2K': 2048,
    '4K': 3840,
}


def _compute_gpt_image_size(aspect_ratio: str, resolution: str = '2K') -> str:
    """Dynamically compute WxH for gpt-image-* from aspect ratio and resolution.

    Rules: both edges multiples of 16, max edge ≤ 3840, ratio ≤ 3:1.
    """
    parts = aspect_ratio.split(':')
    if len(parts) != 2:
        return 'auto'
    try:
        aw, ah = int(parts[0]), int(parts[1])
    except ValueError:
        return 'auto'
    if aw <= 0 or ah <= 0:
        return 'auto'

    long_edge = _RESOLUTION_LONG_EDGE.get(resolution.upper(), 2048)

    if aw >= ah:
        w = long_edge
        h = round(w * ah / aw)
    else:
        h = long_edge
        w = round(h * aw / ah)

    w = max(16, (w // 16) * 16)
    h = max(16, (h // 16) * 16)

    # Clamp total pixels to API limit (max 8,294,400)
    max_pixels = 8_294_400
    if w * h > max_pixels:
        scale = (max_pixels / (w * h)) ** 0.5
        w = max(16, (int(w * scale) // 16) * 16)
        h = max(16, (int(h * scale) // 16) * 16)

    return f'{w}x{h}'


class OpenAIImageProvider(ImageProvider):
    """
    Image generation using OpenAI SDK.

    Two code paths selected by model name:
    • Native images API (gpt-image-2 / dall-e-*): images.generate / images.edit
    • Chat completions path (Gemini via proxy, etc.): chat.completions with modalities

    Supports multiple resolution parameter formats for different providers.
    Resolution support varies by provider:
    - Some providers support 2K/4K via extra_body parameters
    - Some providers only support 1K regardless of settings
    
    The provider will try multiple parameter formats to maximize compatibility.
    """
    
    def __init__(self, api_key: str, api_base: str = None, model: str = "gemini-3-pro-image-preview"):
        """
        Initialize OpenAI image provider
        
        Args:
            api_key: API key
            api_base: API base URL (e.g., https://aihubmix.com/v1)
            model: Model name to use
        """
        self.client = OpenAI(
            api_key=api_key,
            base_url=api_base,
            timeout=get_config().OPENAI_TIMEOUT,  # set timeout from config
            max_retries=get_config().OPENAI_MAX_RETRIES  # set max retries from config
        )
        self.api_base = api_base or ""
        self.model = model
    
    def _encode_image_to_base64(self, image: Image.Image) -> str:
        """
        Encode PIL Image to base64 string
        
        Args:
            image: PIL Image object
            
        Returns:
            Base64 encoded string
        """
        buffered = BytesIO()
        # Convert to RGB if necessary (e.g., RGBA images)
        if image.mode in ('RGBA', 'LA', 'P'):
            image = image.convert('RGB')
        image.save(buffered, format="JPEG", quality=95)
        return base64.b64encode(buffered.getvalue()).decode('utf-8')
    
    def _build_extra_body(self, aspect_ratio: str, resolution: str) -> dict:
        """
        Build extra_body parameters for resolution control.
        
        Uses multiple format strategies to support different providers:
        1. Flat style: aspect_ratio + resolution at top level
        2. Nested style: generationConfig.imageConfig structure
        
        Args:
            aspect_ratio: Image aspect ratio (e.g., "16:9", "9:16")
            resolution: Image resolution ("1K", "2K", "4K")
            
        Returns:
            Dict with extra_body parameters
        """
        # Ensure resolution is uppercase (some providers require "4K" not "4k")
        resolution_upper = resolution.upper()
        
        # Build comprehensive extra_body that works with multiple providers
        extra_body = {
            # Flat style parameters
            "aspect_ratio": aspect_ratio,
            "resolution": resolution_upper,
            
            # Nested style structure (compatible with some providers)
            "generationConfig": {
                "imageConfig": {
                    "aspectRatio": aspect_ratio,
                    "imageSize": resolution_upper,
                }
            }
        }
        
        return extra_body

    def _is_native_images_api_model(self) -> bool:
        """Return True when the model should use images.generate / images.edit."""
        return self.model.lower() in _NATIVE_IMAGES_API_MODELS

    def _pil_to_png_bytes(self, image: Image.Image) -> bytes:
        buf = BytesIO()
        # Preserve alpha channel: the images.edit endpoint uses it as a mask
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        image.save(buf, format='PNG')
        buf.seek(0)
        return buf.read()

    def _resolve_size(self, aspect_ratio: str, resolution: str = '2K') -> str:
        """Map aspect_ratio to a size string appropriate for the current model."""
        model = self.model.lower()
        if model == 'dall-e-3':
            return _DALLE3_SIZE_MAP.get(aspect_ratio, '1024x1024')
        if model == 'dall-e-2':
            return _DALLE2_SIZE_MAP.get(aspect_ratio, '1024x1024')
        return _compute_gpt_image_size(aspect_ratio, resolution)

    def _resolve_quality(self):
        """Return quality param appropriate for the current model, or None to omit."""
        model = self.model.lower()
        if model == 'dall-e-3':
            return 'standard'   # dall-e-3 only accepts standard / hd
        if model == 'dall-e-2':
            return None          # dall-e-2 has no quality param
        return 'auto'            # gpt-image-* accepts auto / low / medium / high

    def _decode_image_response(self, item) -> Image.Image:
        """Extract PIL Image from an images API response item (b64_json or url)."""
        if item.b64_json:
            return Image.open(BytesIO(base64.b64decode(item.b64_json)))
        if item.url:
            resp = requests.get(item.url, timeout=60, stream=True)
            resp.raise_for_status()
            return Image.open(BytesIO(resp.content))
        raise ValueError("images API returned neither b64_json nor url")

    def _generate_with_images_api(
        self,
        prompt: str,
        ref_images: Optional[List[Image.Image]],
        aspect_ratio: str,
        resolution: str = '2K',
    ) -> Optional[Image.Image]:
        """Use the native OpenAI images API (gpt-image-* / dall-e-*)."""
        size = self._resolve_size(aspect_ratio, resolution)
        quality = self._resolve_quality()
        # GPT image models always return b64_json; DALL-E models default to url
        is_dalle = self.model.lower() in _DALLE_MODELS
        response_format = 'b64_json' if is_dalle else None

        if ref_images and self.model.lower() != 'dall-e-3':
            # dall-e-3 does not support images.edit; all other native models do
            # Resize ref image to match target size so the API doesn't reject mismatched dimensions
            w, h = map(int, size.split('x'))
            ref_img = ref_images[0]
            if ref_img.size != (w, h):
                ref_img = ref_img.resize((w, h), Image.LANCZOS)
            image_bytes = self._pil_to_png_bytes(ref_img)
            image_file = BytesIO(image_bytes)
            image_file.name = 'image.png'
            logger.debug("%s: images.edit, size=%s", self.model, size)
            kwargs = dict(model=self.model, image=image_file, prompt=prompt, n=1, size=size)
            if response_format:
                kwargs['response_format'] = response_format
            result = self.client.images.edit(**kwargs)
        else:
            if ref_images:
                logger.warning("dall-e-3 does not support images.edit; ignoring ref_images")
            logger.debug("%s: images.generate, size=%s, quality=%s", self.model, size, quality)
            kwargs = dict(model=self.model, prompt=prompt, n=1, size=size)
            if quality:
                kwargs['quality'] = quality
            if response_format:
                kwargs['response_format'] = response_format
            result = self.client.images.generate(**kwargs)

        return self._decode_image_response(result.data[0])

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
        Generate image using OpenAI SDK
        
        Supports resolution control via extra_body parameters for compatible providers.
        Note: Not all providers support 2K/4K resolution - some may return 1K regardless.
        Note: enable_thinking and thinking_budget are ignored (OpenAI format doesn't support thinking mode)
        
        The provider will:
        1. Try to use extra_body parameters (API易/AvalAI style) for resolution control
        2. Use system message for aspect_ratio as fallback
        
        Args:
            prompt: The image generation prompt
            ref_images: Optional list of reference images
            aspect_ratio: Image aspect ratio
            resolution: Image resolution ("1K", "2K", "4K") - support depends on provider
            enable_thinking: Ignored, kept for interface compatibility
            thinking_budget: Ignored, kept for interface compatibility
            
        Returns:
            Generated PIL Image object, or None if failed
        """
        try:
            # Route gpt-image-2 / dall-e-* to the native images API
            if self._is_native_images_api_model():
                return self._generate_with_images_api(prompt, ref_images, aspect_ratio, resolution)

            # Build message content
            content = []
            
            # Add reference images first (if any)
            if ref_images:
                for ref_img in ref_images:
                    base64_image = self._encode_image_to_base64(ref_img)
                    content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    })
            
            # Add text prompt
            content.append({"type": "text", "text": prompt})
            
            logger.debug(f"Calling OpenAI API for image generation with {len(ref_images) if ref_images else 0} reference images...")
            logger.debug(f"Config - aspect_ratio: {aspect_ratio}, resolution: {resolution}")
            
            # Build extra_body with resolution parameters for compatible providers
            extra_body = self._build_extra_body(aspect_ratio, resolution)
            logger.debug(f"Using extra_body for resolution control: {extra_body}")
            
            # Use both system message (for basic providers) and extra_body (for advanced providers)
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": f"aspect_ratio={aspect_ratio}, resolution={resolution}"},
                    {"role": "user", "content": content},
                ],
                modalities=["text", "image"],
                extra_body=extra_body
            )
            
            logger.debug("OpenAI API call completed")
            
            # Extract image from response - handle different response formats
            message = response.choices[0].message
            
            # Debug: log available attributes
            logger.debug(f"Response message attributes: {dir(message)}")
            
            # Try multi_mod_content first (custom format from some proxies)
            if hasattr(message, 'multi_mod_content') and message.multi_mod_content:
                parts = message.multi_mod_content
                for part in parts:
                    if "text" in part:
                        logger.debug(f"Response text: {part['text'][:100] if len(part['text']) > 100 else part['text']}")
                    if "inline_data" in part:
                        image_data = base64.b64decode(part["inline_data"]["data"])
                        image = Image.open(BytesIO(image_data))
                        logger.debug(f"Successfully extracted image: {image.size}, {image.mode}")
                        return image
            
            # Try standard OpenAI content format (list of content parts)
            if hasattr(message, 'content') and message.content:
                # If content is a list (multimodal response)
                if isinstance(message.content, list):
                    for part in message.content:
                        if isinstance(part, dict):
                            # Handle image_url type
                            if part.get('type') == 'image_url':
                                image_url = part.get('image_url', {}).get('url', '')
                                if image_url.startswith('data:image'):
                                    # Extract base64 data from data URL
                                    base64_data = image_url.split(',', 1)[1]
                                    image_data = base64.b64decode(base64_data)
                                    image = Image.open(BytesIO(image_data))
                                    logger.debug(f"Successfully extracted image from content: {image.size}, {image.mode}")
                                    return image
                            # Handle text type
                            elif part.get('type') == 'text':
                                text = part.get('text', '')
                                if text:
                                    logger.debug(f"Response text: {text[:100] if len(text) > 100 else text}")
                        elif hasattr(part, 'type'):
                            # Handle as object with attributes
                            if part.type == 'image_url':
                                image_url = getattr(part, 'image_url', {})
                                if isinstance(image_url, dict):
                                    url = image_url.get('url', '')
                                else:
                                    url = getattr(image_url, 'url', '')
                                if url.startswith('data:image'):
                                    base64_data = url.split(',', 1)[1]
                                    image_data = base64.b64decode(base64_data)
                                    image = Image.open(BytesIO(image_data))
                                    logger.debug(f"Successfully extracted image from content object: {image.size}, {image.mode}")
                                    return image
                # If content is a string, try to extract image from it
                elif isinstance(message.content, str):
                    content_str = message.content
                    logger.debug(f"Response content (string): {content_str[:200] if len(content_str) > 200 else content_str}")
                    
                    # Try to extract Markdown image URL: ![...](url)
                    markdown_pattern = r'!\[.*?\]\((https?://[^\s\)]+)\)'
                    markdown_matches = re.findall(markdown_pattern, content_str)
                    if markdown_matches:
                        image_url = markdown_matches[0]  # Use the first image URL found
                        logger.debug(f"Found Markdown image URL: {image_url}")
                        try:
                            response = requests.get(image_url, timeout=30, stream=True)
                            response.raise_for_status()
                            image = Image.open(BytesIO(response.content))
                            image.load()  # Ensure image is fully loaded
                            logger.debug(f"Successfully downloaded image from Markdown URL: {image.size}, {image.mode}")
                            return image
                        except Exception as download_error:
                            logger.warning(f"Failed to download image from Markdown URL: {download_error}")
                    
                    # Try to extract plain URL (not in Markdown format)
                    url_pattern = r'(https?://[^\s\)\]]+\.(?:png|jpg|jpeg|gif|webp|bmp)(?:\?[^\s\)\]]*)?)'
                    url_matches = re.findall(url_pattern, content_str, re.IGNORECASE)
                    if url_matches:
                        image_url = url_matches[0]
                        logger.debug(f"Found plain image URL: {image_url}")
                        try:
                            response = requests.get(image_url, timeout=30, stream=True)
                            response.raise_for_status()
                            image = Image.open(BytesIO(response.content))
                            image.load()
                            logger.debug(f"Successfully downloaded image from plain URL: {image.size}, {image.mode}")
                            return image
                        except Exception as download_error:
                            logger.warning(f"Failed to download image from plain URL: {download_error}")
                    
                    # Try to extract base64 data URL from string
                    base64_pattern = r'data:image/[^;]+;base64,([A-Za-z0-9+/=]+)'
                    base64_matches = re.findall(base64_pattern, content_str)
                    if base64_matches:
                        base64_data = base64_matches[0]
                        logger.debug(f"Found base64 image data in string")
                        try:
                            image_data = base64.b64decode(base64_data)
                            image = Image.open(BytesIO(image_data))
                            logger.debug(f"Successfully extracted base64 image from string: {image.size}, {image.mode}")
                            return image
                        except Exception as decode_error:
                            logger.warning(f"Failed to decode base64 image from string: {decode_error}")
            
            # Log raw response for debugging
            logger.warning(f"Unable to extract image. Raw message type: {type(message)}")
            logger.warning(f"Message content type: {type(getattr(message, 'content', None))}")
            raw = str(getattr(message, 'content', 'N/A'))
            logger.warning(f"Message content: {raw[:300]}{'...(truncated)' if len(raw) > 300 else ''}")
            
            raise ValueError("No valid multimodal response received from OpenAI API")
            
        except Exception as e:
            error_detail = f"Error generating image with OpenAI (model={self.model}): {type(e).__name__}: {str(e)}"
            logger.error(error_detail, exc_info=True)
            raise Exception(error_detail) from e
