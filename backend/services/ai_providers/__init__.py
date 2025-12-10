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
        OPENAI_API_KEY: API key (required, GOOGLE_API_KEY cannot be used)
        OPENAI_API_BASE: API base URL (e.g., https://aihubmix.com/v1)
"""
import os
import logging
from typing import Optional

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


def get_text_provider(
    api_key: Optional[str] = None,
    api_base: Optional[str] = None,
    model: str = "gemini-2.5-flash"
) -> TextProvider:
    """
    Factory function to get text generation provider based on configuration
    
    Args:
        api_key: Override API key (uses env var if not provided)
        api_base: Override API base URL (uses env var if not provided)
        model: Model name to use
        
    Returns:
        TextProvider instance (GenAITextProvider or OpenAITextProvider)
    """
    provider_format = get_provider_format()
    
    if provider_format == 'openai':
        # OpenAI format
        key = api_key or os.getenv('OPENAI_API_KEY')
        base = api_base or os.getenv('OPENAI_API_BASE')
        
        if not key:
            raise ValueError(
                "OPENAI_API_KEY environment variable is required when AI_PROVIDER_FORMAT=openai. "
                "Note: GOOGLE_API_KEY cannot be used for OpenAI format."
            )
        
        logger.info(f"Using OpenAI format for text generation, model: {model}")
        return OpenAITextProvider(api_key=key, api_base=base, model=model)
    else:
        # Gemini format (default)
        key = api_key or os.getenv('GOOGLE_API_KEY')
        base = api_base or os.getenv('GOOGLE_API_BASE')
        
        if not key:
            raise ValueError("GOOGLE_API_KEY environment variable is required")
        
        logger.info(f"Using Gemini format for text generation, model: {model}")
        return GenAITextProvider(api_key=key, api_base=base, model=model)


def get_image_provider(
    api_key: Optional[str] = None,
    api_base: Optional[str] = None,
    model: str = "gemini-3-pro-image-preview"
) -> ImageProvider:
    """
    Factory function to get image generation provider based on configuration
    
    Args:
        api_key: Override API key (uses env var if not provided)
        api_base: Override API base URL (uses env var if not provided)
        model: Model name to use
        
    Returns:
        ImageProvider instance (GenAIImageProvider or OpenAIImageProvider)
        
    Note:
        OpenAI format does NOT support 4K resolution, only 1K is available.
        If you need higher resolution images, use GenAI format.
    """
    provider_format = get_provider_format()
    
    if provider_format == 'openai':
        # OpenAI format
        key = api_key or os.getenv('OPENAI_API_KEY')
        base = api_base or os.getenv('OPENAI_API_BASE')
        
        if not key:
            raise ValueError(
                "OPENAI_API_KEY environment variable is required when AI_PROVIDER_FORMAT=openai. "
                "Note: GOOGLE_API_KEY cannot be used for OpenAI format."
            )
        
        logger.info(f"Using OpenAI format for image generation, model: {model}")
        logger.warning("OpenAI format only supports 1K resolution, 4K is not available")
        return OpenAIImageProvider(api_key=key, api_base=base, model=model)
    else:
        # Gemini format (default)
        key = api_key or os.getenv('GOOGLE_API_KEY')
        base = api_base or os.getenv('GOOGLE_API_BASE')
        
        if not key:
            raise ValueError("GOOGLE_API_KEY environment variable is required")
        
        logger.info(f"Using Gemini format for image generation, model: {model}")
        return GenAIImageProvider(api_key=key, api_base=base, model=model)

