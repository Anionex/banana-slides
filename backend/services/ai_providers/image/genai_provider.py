"""
Google GenAI SDK implementation for image generation

Supports two modes:
- Google AI Studio: Uses API key authentication
- Vertex AI: Uses GCP service account authentication
"""
import logging
import re
import requests
from io import BytesIO
from typing import Optional, List
from google import genai
from google.genai import types
from PIL import Image, UnidentifiedImageError
from tenacity import retry, stop_after_attempt, wait_exponential
from .base import ImageProvider
from config import get_config

logger = logging.getLogger(__name__)


class GenAIImageProvider(ImageProvider):
    """Image generation using Google GenAI SDK (supports both AI Studio and Vertex AI)"""

    def __init__(
        self,
        api_key: str = None,
        api_base: str = None,
        model: str = "gemini-3-pro-image-preview",
        vertexai: bool = False,
        project_id: str = None,
        location: str = None
    ):
        """
        Initialize GenAI image provider
        """
        timeout_ms = int(get_config().GENAI_TIMEOUT * 1000)

        if vertexai:
            # Vertex AI mode
            logger.info(f"Initializing GenAI image provider in Vertex AI mode, project: {project_id}, location: {location}")
            self.client = genai.Client(
                vertexai=True,
                project=project_id,
                location=location or 'us-central1',
                http_options=types.HttpOptions(timeout=timeout_ms)
            )
        else:
            # AI Studio mode
            http_options = types.HttpOptions(
                base_url=api_base,
                timeout=timeout_ms
            ) if api_base else types.HttpOptions(timeout=timeout_ms)

            self.client = genai.Client(
                http_options=http_options,
                api_key=api_key
            )

        self.model = model
    
    @retry(
        stop=stop_after_attempt(get_config().GENAI_MAX_RETRIES + 1),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def generate_image(
        self,
        prompt: str,
        ref_images: Optional[List[Image.Image]] = None,
        aspect_ratio: str = "16:9",
        resolution: str = "2K"
    ) -> Optional[Image.Image]:
        """
        Generate image using Google GenAI SDK
        """
        try:
            # Build contents list
            contents = []
            if ref_images:
                for ref_img in ref_images:
                    contents.append(ref_img)
            contents.append(prompt)
            
            logger.debug(f"Calling GenAI API (Model: {self.model})...")
            
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
            
            if not response.parts:
                raise ValueError("Response had no parts.")

            # Priority 1: Try Standard SDK Image Extraction (Inline Data)
            for i, part in enumerate(response.parts):
                try:
                    # Some SDK versions might expose part.image or part.inline_data
                    # We try the method used in your original code first
                    image = part.as_image()
                    if image:
                        logger.debug(f"Successfully extracted inline image from part {i}")
                        return image
                except Exception:
                    # It's normal to fail here if the part is just text
                    pass

            # Priority 2: Try URL Extraction from Text (Proxy/Markdown fallback)
            # We do this in a second pass or if the first pass failed
            for i, part in enumerate(response.parts):
                if not part.text:
                    continue
                    
                text_content = part.text
                logger.debug(f"Part {i} contains text, checking for URLs...")
                
                # Regex matches http/https URLs until whitespace or closing parenthesis
                url_pattern = r'(https?://[^\s\)]+)'
                urls = re.findall(url_pattern, text_content)
                
                for url in urls:
                    # Clean punctuation that might be captured (Markdown brackets, quotes, trailing dots)
                    clean_url = url.strip(')"\'].;,')
                    
                    try:
                        logger.debug(f"Attempting to download image from URL: {clean_url}")
                        # Set a timeout so we don't hang forever
                        img_response = requests.get(clean_url, timeout=30)
                        img_response.raise_for_status() # Check for 404/500 errors
                        
                        # Try to open content as image directly
                        image = Image.open(BytesIO(img_response.content))
                        image.load() # Verify integrity
                        logger.debug(f"Successfully downloaded and loaded image from URL: {clean_url}")
                        return image
                        
                    except (requests.RequestException, UnidentifiedImageError) as err:
                        logger.warning(f"Found URL {clean_url} but failed to load image: {err}")
                        continue

            # If we reach here, no image was found
            error_msg = f"No image found in API response (checked {len(response.parts)} parts)."
            # Add snippet of text content for debugging
            for i, part in enumerate(response.parts):
                if part.text:
                    error_msg += f" Part {i} text: {part.text[:200]}..."
            
            raise ValueError(error_msg)
            
        except Exception as e:
            error_detail = f"Error generating image with GenAI: {type(e).__name__}: {str(e)}"
            logger.error(error_detail, exc_info=True)
            raise Exception(error_detail) from e
