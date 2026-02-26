"""
Google GenAI SDK — text generation provider

Operates in two authentication modes selected at construction time:
  * API-key mode  (Google AI Studio or compatible proxy)
  * Vertex AI mode (GCP service-account credentials via GOOGLE_APPLICATION_CREDENTIALS)
"""
import logging
from typing import Generator
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential
from .base import TextProvider, strip_think_tags
from config import get_config
from ..genai_client import make_genai_client

logger = logging.getLogger(__name__)


def _log_retry(retry_state):
    """记录重试信息"""
    logger.warning(
        f"GenAI 请求失败，正在重试 ({retry_state.attempt_number}/{get_config().GENAI_MAX_RETRIES + 1})，"
        f"错误: {retry_state.outcome.exception() if retry_state.outcome else 'unknown'}"
    )


def _validate_response(response):
    """验证响应是否有效，无效则抛出异常触发重试"""
    if response.text is None:
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'finish_reason'):
                logger.warning(f"Response text is None, finish_reason: {candidate.finish_reason}")
            if hasattr(candidate, 'safety_ratings'):
                logger.warning(f"Safety ratings: {candidate.safety_ratings}")
        raise ValueError("AI model returned empty response (response.text is None)")
    return strip_think_tags(response.text)


class GenAITextProvider(TextProvider):
    """Text generation via Google GenAI SDK (AI Studio / Vertex AI)"""

    def __init__(
        self,
        model: str = "gemini-3-flash-preview",
        api_key: str = None,
        api_base: str = None,
        vertexai: bool = False,
        project_id: str = None,
        location: str = None,
    ):
        self.client = make_genai_client(
            vertexai=vertexai,
            api_key=api_key,
            api_base=api_base,
            project_id=project_id,
            location=location,
        )
        self.model = model
    
    @retry(
        stop=stop_after_attempt(get_config().GENAI_MAX_RETRIES + 1),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
        before_sleep=_log_retry
    )
    def generate_text(self, prompt: str, thinking_budget: int = 0) -> str:
        """
        Generate text using Google GenAI SDK
        
        Args:
            prompt: The input prompt
            thinking_budget: Thinking budget for the model (0 = disable thinking)
            
        Returns:
            Generated text
        """
        # 构建配置，只有在 thinking_budget > 0 时才启用推理模式
        config_params = {}
        if thinking_budget > 0:
            config_params['thinking_config'] = types.ThinkingConfig(thinking_budget=thinking_budget)
        
        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(**config_params) if config_params else None,
        )
        return _validate_response(response)
    
    @retry(
        stop=stop_after_attempt(get_config().GENAI_MAX_RETRIES + 1),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
        before_sleep=_log_retry
    )
    def generate_with_image(self, prompt: str, image_path: str, thinking_budget: int = 0) -> str:
        """
        Generate text with image input using Google GenAI SDK (multimodal)
        
        Args:
            prompt: The input prompt
            image_path: Path to the image file
            thinking_budget: Thinking budget for the model (0 = disable thinking)
            
        Returns:
            Generated text
        """
        from PIL import Image
        
        # 加载图片
        img = Image.open(image_path)
        
        # 构建多模态内容
        contents = [img, prompt]
        
        # 构建配置，只有在 thinking_budget > 0 时才启用推理模式
        config_params = {}
        if thinking_budget > 0:
            config_params['thinking_config'] = types.ThinkingConfig(thinking_budget=thinking_budget)
        
        response = self.client.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(**config_params) if config_params else None,
        )
        return _validate_response(response)

    def generate_text_stream(self, prompt: str, thinking_budget: int = 0) -> Generator[str, None, None]:
        """Stream text using Google GenAI SDK's generate_content_stream."""
        config_params = {}
        if thinking_budget > 0:
            config_params['thinking_config'] = types.ThinkingConfig(thinking_budget=thinking_budget)

        response = self.client.models.generate_content_stream(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(**config_params) if config_params else None,
        )
        for chunk in response:
            # Skip thinking chunks, only yield text content
            if chunk.text:
                yield chunk.text