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
    return response.text


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