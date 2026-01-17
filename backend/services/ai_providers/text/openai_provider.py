"""
OpenAI SDK implementation for text generation
"""
import logging
from openai import OpenAI
from .base import TextProvider
from config import get_config

logger = logging.getLogger(__name__)


class OpenAITextProvider(TextProvider):
    """Text generation using OpenAI SDK (compatible with Gemini via proxy)"""
    
    def __init__(self, api_key: str, api_base: str = None, model: str = "gemini-3-flash-preview"):
        """
        Initialize OpenAI text provider
        
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
        self.model = model
    
    def generate_text(self, prompt: str, thinking_budget: int = 0) -> str:
        """
        Generate text using OpenAI SDK
        
        Args:
            prompt: The input prompt
            thinking_budget: Not used in OpenAI format, kept for interface compatibility (0 = default)
            
        Returns:
            Generated text
        """
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content
