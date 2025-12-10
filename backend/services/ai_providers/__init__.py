"""
AI Providers factory module

Provides factory functions to get the appropriate text/image generation providers
based on environment configuration.

Environment Variables:
    AI_PROVIDER_FORMAT: "gemini" (default) or "openai"
    
    For Gemini format (Google GenAI SDK):
        GOOGLE_API_KEY: API key
        GOOGLE_API_BASE: API base URL (e.g., https://aihubmix.com/gemini)
    
    For OpenAI format:
        OPENAI_API_KEY: API key
        OPENAI_API_BASE: API base URL (e.g., https://aihubmix.com/v1)
"""
import os
import logging
from typing import Tuple, Type

from .text import TextProvider, GenAITextProvider, OpenAITextProvider
from .image import ImageProvider, GenAIImageProvider, OpenAIImageProvider

logger = logging.getLogger(__name__)

__all__ = [
    'TextProvider', 'GenAITextProvider', 'OpenAITextProvider',
    'ImageProvider', 'GenAIImageProvider', 'OpenAIImageProvider',
    'get_text_provider', 'get_image_provider', 'get_provider_format'
]


def get_provider_format() -> str:
    """
    Get the configured AI provider format
    
    Returns:
        "gemini" or "openai"
    """
    return os.getenv('AI_PROVIDER_FORMAT', 'gemini').lower()


def _get_provider_config() -> Tuple[str, str, str]:
    """
    Get provider configuration based on AI_PROVIDER_FORMAT
    
    Returns:
        Tuple of (provider_format, api_key, api_base)
        
    Raises:
        ValueError: If required API key is not configured
    """
    provider_format = get_provider_format()
    
    if provider_format == 'openai':
        api_key = os.getenv('OPENAI_API_KEY')
        api_base = os.getenv('OPENAI_API_BASE')
        
        if not api_key:
            raise ValueError(
                "OPENAI_API_KEY environment variable is required when AI_PROVIDER_FORMAT=openai. "
                "Note: GOOGLE_API_KEY cannot be used for OpenAI format."
            )
    else:
        # Gemini format (default)
        provider_format = 'gemini'
        api_key = os.getenv('GOOGLE_API_KEY')
        api_base = os.getenv('GOOGLE_API_BASE')
        
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable is required")
    
    return provider_format, api_key, api_base


def get_text_provider(model: str = "gemini-2.5-flash") -> TextProvider:
    """
    Factory function to get text generation provider based on configuration
    
    Args:
        model: Model name to use
        
    Returns:
        TextProvider instance (GenAITextProvider or OpenAITextProvider)
    """
    provider_format, api_key, api_base = _get_provider_config()
    
    if provider_format == 'openai':
        logger.info(f"Using OpenAI format for text generation, model: {model}")
        return OpenAITextProvider(api_key=api_key, api_base=api_base, model=model)
    else:
        logger.info(f"Using Gemini format for text generation, model: {model}")
        return GenAITextProvider(api_key=api_key, api_base=api_base, model=model)


def get_image_provider(model: str = "gemini-3-pro-image-preview") -> ImageProvider:
    """
    Factory function to get image generation provider based on configuration
    
    Args:
        model: Model name to use
        
    Returns:
        ImageProvider instance (GenAIImageProvider or OpenAIImageProvider)
        
    Note:
        OpenAI format does NOT support 4K resolution, only 1K is available.
        If you need higher resolution images, use Gemini format.
    """
    provider_format, api_key, api_base = _get_provider_config()
    
    if provider_format == 'openai':
        logger.info(f"Using OpenAI format for image generation, model: {model}")
        logger.warning("OpenAI format only supports 1K resolution, 4K is not available")
        return OpenAIImageProvider(api_key=api_key, api_base=api_base, model=model)
    else:
        logger.info(f"Using Gemini format for image generation, model: {model}")
        return GenAIImageProvider(api_key=api_key, api_base=api_base, model=model)
