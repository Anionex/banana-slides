"""
Google GenAI SDK implementation for text generation
"""
import logging
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential
from .base import TextProvider
from config import get_config

logger = logging.getLogger(__name__)


class GenAITextProvider(TextProvider):
    """Text generation using Google GenAI SDK"""
    
    def __init__(self, api_key: str, api_base: str = None, model: str = "gemini-3-flash-preview"):
        """
        Initialize GenAI text provider
        
        Args:
            api_key: Google API key
            api_base: API base URL (for proxies like aihubmix)
            model: Model name to use
        """
        timeout_ms = int(get_config().GENAI_TIMEOUT * 1000)
        
        # 构建 HttpOptions
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
