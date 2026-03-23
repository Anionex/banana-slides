"""
Anthropic (Claude) SDK implementation for text generation
"""
import base64
import logging
from typing import Generator, Optional
from anthropic import Anthropic
from .base import TextProvider, strip_think_tags
from config import get_config

logger = logging.getLogger(__name__)


class AnthropicTextProvider(TextProvider):
    """Text generation using Anthropic Claude SDK"""

    def __init__(self, api_key: str, api_base: str = None, model: str = "claude-3-5-sonnet-20241022"):
        """
        Initialize Anthropic text provider

        Args:
            api_key: API key
            api_base: API base URL (e.g., https://api.anthropic.com)
            model: Model name to use
        """
        self.client = Anthropic(
            api_key=api_key,
            base_url=api_base,
            timeout=get_config().OPENAI_TIMEOUT,
            max_retries=get_config().OPENAI_MAX_RETRIES
        )
        self.model = model
        self.max_tokens = get_config().ANTHROPIC_MAX_TOKENS

    def generate_text(self, prompt: str, thinking_budget: int = 0) -> str:
        """
        Generate text using Anthropic Claude SDK

        Args:
            prompt: The input prompt
            thinking_budget: Not used in Anthropic format, kept for interface compatibility

        Returns:
            Generated text
        """
        response = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        text = response.content[0].text if response.content else ""
        return strip_think_tags(text)

    def generate_text_stream(self, prompt: str, thinking_budget: int = 0) -> Generator[str, None, None]:
        """Stream text using Anthropic Claude SDK with stream=True."""
        with self.client.messages.stream(
            model=self.model,
            max_tokens=self.max_tokens,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for text in stream.text_stream:
                yield text

    def generate_with_image(self, prompt: str, image_path: str, thinking_budget: int = 0) -> str:
        """Generate text with image input using Anthropic Claude API."""
        with open(image_path, "rb") as image_file:
            encoded = base64.b64encode(image_file.read()).decode("ascii")

        # Detect image type
        if image_path.lower().endswith(".png"):
            media_type = "image/png"
        elif image_path.lower().endswith(".gif"):
            media_type = "image/gif"
        elif image_path.lower().endswith(".webp"):
            media_type = "image/webp"
        else:
            media_type = "image/jpeg"

        response = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": encoded,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )

        text = response.content[0].text if response.content else ""
        return strip_think_tags(text)
