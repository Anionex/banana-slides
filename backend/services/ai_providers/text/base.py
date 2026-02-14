"""
Abstract base class for text generation providers
"""
import re
from abc import ABC, abstractmethod


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
