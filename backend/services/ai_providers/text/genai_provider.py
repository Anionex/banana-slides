"""
Google GenAI SDK — text generation provider

Operates in two authentication modes selected at construction time:
  * API-key mode  (Google AI Studio or compatible proxy)
  * Vertex AI mode (GCP service-account credentials via GOOGLE_APPLICATION_CREDENTIALS)
"""
import logging
import re
from typing import Generator
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential
from .base import TextProvider, strip_think_tags
from .stream_control import stream_timeout, stream_stopped
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
        config = get_config()
        self.request_timeout_seconds = config.GENAI_TIMEOUT
        self.max_attempts = config.GENAI_MAX_RETRIES + 1
    
    def _generation_config(self, thinking_budget: int):
        """Use the lowest supported thinking setting when reasoning is disabled.

        Omitting thinking_config selects the model default (high on Gemini 3).
        Models that cannot disable thinking use their documented minimum.
        Leave unknown/legacy model aliases unchanged rather than send unsupported fields.
        """
        if thinking_budget > 0:
            thinking = types.ThinkingConfig(thinking_budget=thinking_budget)
        elif thinking_budget == 0:
            model = self.model.rsplit('/', 1)[-1].lower()
            match = re.fullmatch(
                r'gemini-(3(?:\.[178])?|2\.5)-(flash-lite|flash|pro)(?:-preview(?:-\d{2}-\d{2})?)?',
                model,
            )
            if not match:
                return None
            version, family = match.groups()
            if version.startswith('3'):
                thinking = types.ThinkingConfig(
                    thinking_level='low' if family == 'pro' or version in ('3.7', '3.8') else 'minimal'
                )
            else:
                thinking = types.ThinkingConfig(thinking_budget=128 if family == 'pro' else 0)
        else:
            return None
        return types.GenerateContentConfig(thinking_config=thinking)

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
            thinking_budget: Thinking budget for the model (0 = disabled or lowest supported thinking)
            
        Returns:
            Generated text
        """
        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=self._generation_config(thinking_budget),
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
            thinking_budget: Thinking budget for the model (0 = disabled or lowest supported thinking)
            
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
            config=self._generation_config(thinking_budget),
        )
        return _validate_response(response)

    def generate_text_stream(self, prompt: str, thinking_budget: int = 0) -> Generator[str, None, None]:
        """Stream text using Google GenAI SDK's generate_content_stream."""
        config = self._generation_config(thinking_budget)
        timeout = stream_timeout()
        if timeout is not None:
            config = config or types.GenerateContentConfig()
            config.http_options = types.HttpOptions(
                timeout=max(1, int(min(timeout, self.request_timeout_seconds) * 1000)),
                retry_options=types.HttpRetryOptions(attempts=1),
            )
        response = self.client.models.generate_content_stream(
            model=self.model,
            contents=prompt,
            config=config,
        )
        try:
            for chunk in response:
                if stream_stopped():
                    break
                if chunk.text:
                    yield chunk.text
        finally:
            response.close()
