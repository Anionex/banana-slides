"""
Google GenAI SDK implementation for image generation
"""
import logging
from typing import Optional, List
from google import genai
from google.genai import types
from PIL import Image
from .base import ImageProvider

logger = logging.getLogger(__name__)


class GenAIImageProvider(ImageProvider):
    """Image generation using Google GenAI SDK"""
    
    def __init__(self, api_key: str, api_base: str = None, model: str = "gemini-3-pro-image-preview"):
        """
        Initialize GenAI image provider
        
        Args:
            api_key: Google API key
            api_base: API base URL (for proxies like aihubmix)
            model: Model name to use
        """
        self.client = genai.Client(
            http_options=types.HttpOptions(base_url=api_base) if api_base else None,
            api_key=api_key
        )
        self.model = model
    
    def generate_image(
        self,
        prompt: str,
        ref_images: Optional[List[Image.Image]] = None,
        aspect_ratio: str = "16:9",
        resolution: str = "2K"
    ) -> Optional[Image.Image]:
        """
        Generate image using Google GenAI SDK
        
        Args:
            prompt: The image generation prompt
            ref_images: Optional list of reference images
            aspect_ratio: Image aspect ratio
            resolution: Image resolution (supports "1K", "2K", "4K")
            
        Returns:
            Generated PIL Image object, or None if failed
        """
        try:
            # Build contents list with prompt and reference images
            contents = []
            
            # Add reference images first (if any)
            if ref_images:
                for ref_img in ref_images:
                    contents.append(ref_img)
            
            # Add text prompt
            contents.append(prompt)
            
            logger.debug(f"Calling GenAI API for image generation with {len(ref_images) if ref_images else 0} reference images...")
            logger.debug(f"Config - aspect_ratio: {aspect_ratio}, resolution: {resolution}")
            
            response = self.client.models.generate_content(
                model=self.model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_modalities=['TEXT', 'IMAGE'],
                    image_config=types.ImageConfig(
                        aspect_ratio=aspect_ratio,
                        image_size=resolution
                    ),
                )
            )
            
            logger.debug("GenAI API call completed")
            
            # Extract image from response
            for i, part in enumerate(response.parts):
                if part.text is not None:
                    logger.debug(f"Part {i}: TEXT - {part.text[:100] if len(part.text) > 100 else part.text}")
                else:
                    try:
                        logger.debug(f"Part {i}: Attempting to extract image...")
                        image = part.as_image()
                        if image:
                            logger.debug(f"Successfully extracted image from part {i}")
                            return image
                    except Exception as e:
                        logger.debug(f"Part {i}: Failed to extract image - {str(e)}")
            
            # No image found in response
            error_msg = "No image found in API response. "
            if response.parts:
                error_msg += f"Response had {len(response.parts)} parts but none contained valid images."
            else:
                error_msg += "Response had no parts."
            
            raise ValueError(error_msg)
            
        except Exception as e:
            error_detail = f"Error generating image with GenAI: {type(e).__name__}: {str(e)}"
            logger.error(error_detail, exc_info=True)
            raise Exception(error_detail) from e

