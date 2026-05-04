"""
OpenAI SDK implementation for image generation

Supports multiple resolution parameter formats for different OpenAI-compatible providers:
- Flat style: extra_body.aspect_ratio + extra_body.resolution
- Nested style: extra_body.generationConfig.imageConfig.aspectRatio + imageSize

Note: Not all providers support 2K/4K resolution in OpenAI format.
Some may only return 1K regardless of settings.
Resolution validation is handled at the task_manager level for all providers.
"""
import logging
import base64
import re
import requests
from io import BytesIO
from typing import Optional, List, Any
from openai import OpenAI
from PIL import Image
from .base import ImageProvider
from config import get_config

logger = logging.getLogger(__name__)


OPENAI_IMAGES_API_MODELS = {"dall-e-2", "dall-e-3"}
OPENAI_IMAGES_API_PREFIXES = ("gpt-image-",)


class OpenAIImageProvider(ImageProvider):
    """
    Image generation using OpenAI SDK (compatible with Gemini via proxy)
    
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

    def _uses_openai_images_api(self) -> bool:
        """Return True for official OpenAI image models.

        OpenAI image models such as gpt-image-* and dall-e-* are not chat
        completion models; they must use /v1/images/generations or
        /v1/images/edits.
        """
        model = (self.model or "").lower()
        return model in OPENAI_IMAGES_API_MODELS or model.startswith(OPENAI_IMAGES_API_PREFIXES)

    def _supports_openai_image_edits(self) -> bool:
        """Return True when the selected Images API model supports edits."""
        model = (self.model or "").lower()
        return model.startswith("gpt-image-") or model == "dall-e-2"

    def _get_images_api_size(self, aspect_ratio: str) -> str:
        """Map project aspect ratios to sizes accepted by OpenAI Images API."""
        model = (self.model or "").lower()
        aspect = (aspect_ratio or "16:9").strip()

        if model == "dall-e-2":
            return "1024x1024"

        if aspect == "1:1":
            return "1024x1024"

        portrait_ratios = {"9:16", "3:4", "2:3"}
        is_portrait = aspect in portrait_ratios

        if model == "dall-e-3":
            return "1024x1792" if is_portrait else "1792x1024"

        # gpt-image-* supports square, landscape, and portrait sizes.
        return "1024x1536" if is_portrait else "1536x1024"

    def _image_to_png_file(self, image: Image.Image, index: int) -> BytesIO:
        """Convert a PIL image to a named in-memory PNG file for uploads."""
        buffered = BytesIO()
        image_to_save = image
        if image_to_save.mode not in ("RGB", "RGBA"):
            image_to_save = image_to_save.convert("RGBA")
        image_to_save.save(buffered, format="PNG")
        buffered.seek(0)
        buffered.name = f"reference_{index}.png"
        return buffered

    def _extract_image_from_images_response(self, response: Any) -> Image.Image:
        """Extract a PIL image from OpenAI Images API response data."""
        data = getattr(response, "data", None)
        if data is None and isinstance(response, dict):
            data = response.get("data")
        if not data:
            raise ValueError("OpenAI Images API response did not contain image data")

        first = data[0]
        if isinstance(first, dict):
            b64_json = first.get("b64_json")
            image_url = first.get("url")
        else:
            b64_json = getattr(first, "b64_json", None)
            image_url = getattr(first, "url", None)

        if b64_json:
            if "," in b64_json and b64_json.startswith("data:image"):
                b64_json = b64_json.split(",", 1)[1]
            image_data = base64.b64decode(b64_json)
            image = Image.open(BytesIO(image_data))
            image.load()
            logger.debug(f"Successfully extracted OpenAI Images API image: {image.size}, {image.mode}")
            return image

        if image_url:
            download = requests.get(image_url, timeout=30, stream=True)
            download.raise_for_status()
            image = Image.open(BytesIO(download.content))
            image.load()
            logger.debug(f"Successfully downloaded OpenAI Images API image: {image.size}, {image.mode}")
            return image

        raise ValueError("OpenAI Images API response contained neither b64_json nor url")

    def _generate_with_images_api(
        self,
        prompt: str,
        ref_images: Optional[List[Image.Image]],
        aspect_ratio: str,
        resolution: str,
    ) -> Optional[Image.Image]:
        """Generate or edit an image using OpenAI's dedicated Images API."""
        size = self._get_images_api_size(aspect_ratio)
        if resolution and resolution.upper() not in ("1K", "2K"):
            logger.warning(
                "OpenAI Images API does not support project resolution %s; using size=%s",
                resolution,
                size,
            )

        logger.info(
            "Calling OpenAI Images API for image generation: model=%s, size=%s, refs=%s",
            self.model,
            size,
            len(ref_images) if ref_images else 0,
        )

        if ref_images:
            if not self._supports_openai_image_edits():
                logger.warning(
                    "Model %s does not support OpenAI image edits; reference images will be ignored",
                    self.model,
                )
                response = self.client.images.generate(
                    model=self.model,
                    prompt=prompt,
                    size=size,
                    n=1,
                )
                return self._extract_image_from_images_response(response)

            image_files = [self._image_to_png_file(img, idx) for idx, img in enumerate(ref_images)]
            try:
                image_payload = image_files[0] if (self.model or "").lower() == "dall-e-2" else image_files
                response = self.client.images.edit(
                    model=self.model,
                    image=image_payload,
                    prompt=prompt,
                    size=size,
                    n=1,
                )
                return self._extract_image_from_images_response(response)
            finally:
                for image_file in image_files:
                    image_file.close()

        response = self.client.images.generate(
            model=self.model,
            prompt=prompt,
            size=size,
            n=1,
        )
        return self._extract_image_from_images_response(response)
    
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
            if self._uses_openai_images_api():
                return self._generate_with_images_api(
                    prompt=prompt,
                    ref_images=ref_images,
                    aspect_ratio=aspect_ratio,
                    resolution=resolution,
                )

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
