"""
AI Providers factory module

Provides factory functions to get the appropriate text/image generation providers
based on environment configuration.

Configuration Priority (highest to lowest):
    1. Database settings (via Flask app.config)
    2. Environment variables (.env file)
    3. Default values

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
    
    Priority:
        1. Flask app.config['AI_PROVIDER_FORMAT'] (from database settings)
        2. Environment variable AI_PROVIDER_FORMAT
        3. Default: 'gemini'
    
    Returns:
        "gemini" or "openai"
    """
    # Try to get from Flask app config first (database settings)
    try:
        from flask import current_app
        if current_app and hasattr(current_app, 'config'):
            config_value = current_app.config.get('AI_PROVIDER_FORMAT')
            if config_value:
                return str(config_value).lower()
    except RuntimeError:
        # Not in Flask application context
        pass
    
    # Fallback to environment variable
    return os.getenv('AI_PROVIDER_FORMAT', 'gemini').lower()


def _get_provider_config() -> Tuple[str, str, str]:
    """
    Get provider configuration based on AI_PROVIDER_FORMAT
    
    Priority for API keys/base URLs:
        1. Flask app.config (from database settings)
        2. Environment variables
        3. Default values
    
    Returns:
        Tuple of (provider_format, api_key, api_base)
        
    Raises:
        ValueError: If required API key is not configured
    """
    provider_format = get_provider_format()
    
    # Helper to get config value with priority: app.config > env var > default
    def get_config(key: str, default: str = None) -> str:
        try:
            from flask import current_app
            if current_app and hasattr(current_app, 'config'):
                # Check if key exists in config (even if value is empty string)
                # This allows database settings to override env vars even with empty values
                if key in current_app.config:
                    config_value = current_app.config.get(key)
                    # Return the value even if it's empty string (user explicitly set it)
                    if config_value is not None:
                        logger.info(f"[CONFIG] Using {key} from app.config: {config_value}")
                        return str(config_value)
                else:
                    logger.debug(f"[CONFIG] Key {key} not found in app.config, checking env var")
        except RuntimeError as e:
            # Not in Flask application context, fallback to env var
            logger.debug(f"[CONFIG] Not in Flask context for {key}: {e}")
        # Fallback to environment variable or default
        env_value = os.getenv(key)
        if env_value is not None:
            logger.info(f"[CONFIG] Using {key} from environment: {env_value}")
            return env_value
        if default is not None:
            logger.info(f"[CONFIG] Using {key} default: {default}")
            return default
        logger.warning(f"[CONFIG] No value found for {key}, returning None")
        return None
    
    if provider_format == 'openai':
        api_key = get_config('OPENAI_API_KEY') or get_config('GOOGLE_API_KEY')
        api_base = get_config('OPENAI_API_BASE', 'https://aihubmix.com/v1')
        
        if not api_key:
            raise ValueError(
                "OPENAI_API_KEY or GOOGLE_API_KEY (from database settings or environment) is required when AI_PROVIDER_FORMAT=openai."
            )
    else:
        # Gemini format (default)
        provider_format = 'gemini'
        api_key = get_config('GOOGLE_API_KEY')
        api_base = get_config('GOOGLE_API_BASE')
        
        logger.info(f"Provider config - format: {provider_format}, api_base: {api_base}, api_key: {'***' if api_key else 'None'}")
        
        if not api_key:
            raise ValueError("GOOGLE_API_KEY (from database settings or environment) is required")
    
    return provider_format, api_key, api_base


def get_text_provider(model: str = "gemini-3-flash-preview") -> TextProvider:
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
