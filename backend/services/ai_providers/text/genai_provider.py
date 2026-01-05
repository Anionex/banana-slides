"""
Google GenAI SDK implementation for text generation

Supports two modes:
- Google AI Studio: Uses API key authentication
- Vertex AI: Uses GCP service account authentication
"""
import logging
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential
from .base import TextProvider
from config import get_config

logger = logging.getLogger(__name__)


class GenAITextProvider(TextProvider):
    """Text generation using Google GenAI SDK (supports both AI Studio and Vertex AI)"""

    def __init__(
        self,
        api_key: str = None,
        api_base: str = None,
        model: str = "gemini-3-flash-preview",
        vertexai: bool = False,
        project_id: str = None,
        location: str = None
    ):
        """
        Initialize GenAI text provider

        Args:
            api_key: Google API key (for AI Studio mode)
            api_base: API base URL (for proxies like aihubmix, AI Studio mode only)
            model: Model name to use
            vertexai: If True, use Vertex AI instead of AI Studio
            project_id: GCP project ID (required for Vertex AI mode)
            location: GCP region (for Vertex AI mode, default: us-central1)
        """
        timeout_ms = int(get_config().GENAI_TIMEOUT * 1000)

        if vertexai:
            # Vertex AI mode - uses service account credentials from GOOGLE_APPLICATION_CREDENTIALS
            logger.info(f"Initializing GenAI text provider in Vertex AI mode, project: {project_id}, location: {location}")
            self.client = genai.Client(
                vertexai=True,
                project=project_id,
                location=location or 'us-central1',
                http_options=types.HttpOptions(timeout=timeout_ms)
            )
        else:
            # AI Studio mode - uses API key
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
    def generate_text(self, prompt: str, thinking_budget: int = 1000) -> str:
        """
        Generate text using Google GenAI SDK
        
        Args:
            prompt: The input prompt
            thinking_budget: Thinking budget for the model
            
        Returns:
            Generated text
        """
        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_budget=thinking_budget),
            ),
        )
        return response.text
    
    @retry(
        stop=stop_after_attempt(get_config().GENAI_MAX_RETRIES + 1),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def generate_with_image(self, prompt: str, image_path: str, thinking_budget: int = 1000) -> str:
        """
        Generate text with image input using Google GenAI SDK (multimodal)
        
        Args:
            prompt: The input prompt
            image_path: Path to the image file
            thinking_budget: Thinking budget for the model
            
        Returns:
            Generated text
        """
        from PIL import Image
        
        # 加载图片
        img = Image.open(image_path)
        
        # 构建多模态内容
        contents = [img, prompt]
        
        response = self.client.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_budget=thinking_budget),
            ),
        )
        return response.text