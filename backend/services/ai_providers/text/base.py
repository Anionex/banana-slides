"""
Abstract base class for text generation providers
"""
import re
from abc import ABC, abstractmethod
from typing import Optional, Type

from pydantic import BaseModel


def strip_think_tags(text: str) -> str:
    """Remove <think>...</think> blocks (including multiline) from AI responses."""
    if not text:
        return text
    return re.sub(r'<think>.*?</think>\s*', '', text, flags=re.DOTALL).strip()


class TextProvider(ABC):
    """Abstract base class for text generation"""

    @abstractmethod
    def generate_text(self, prompt: str, thinking_budget: int = 1000) -> str:
        """
        Generate text content from prompt

        Args:
            prompt: The input prompt for text generation
            thinking_budget: Budget for thinking/reasoning (provider-specific)

        Returns:
            Generated text content
        """
        pass

    def generate_json(self, prompt: str, schema: Type[BaseModel],
                      thinking_budget: int = 0) -> Optional[BaseModel]:
        """Generate structured JSON using provider-native schema enforcement.

        Returns a parsed Pydantic instance, or None if the provider does not
        support structured output (caller should fall back to text + parse).
        """
        return None

    def generate_json_with_image(self, prompt: str, image_path: str,
                                 schema: Type[BaseModel],
                                 thinking_budget: int = 0) -> Optional[BaseModel]:
        """Like generate_json but with an image input. Returns None if unsupported."""
        return None
