"""
Abstract base class for text generation providers
"""
from abc import ABC, abstractmethod


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
