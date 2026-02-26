"""
Abstract base class for text generation providers
"""
import re
from abc import ABC, abstractmethod
from typing import Generator


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

    def generate_text_stream(self, prompt: str, thinking_budget: int = 0) -> Generator[str, None, None]:
        """
        Stream text content from prompt, yielding chunks as they arrive.

        Default implementation falls back to non-streaming generate_text.
        Subclasses should override for true streaming support.
        """
        yield self.generate_text(prompt, thinking_budget=thinking_budget)
