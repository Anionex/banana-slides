"""
AIService singleton manager for optimizing provider initialization

This module provides a singleton pattern implementation for AIService to avoid
repeated initialization of AI providers (TextProvider and ImageProvider) on every request.

Benefits:
- Reuses AI provider instances across requests
- Reduces initialization overhead
- Better resource management
- Thread-safe for Flask multi-threaded environment

Usage:
    from services.ai_service_manager import get_ai_service
    
    # In your controller
    ai_service = get_ai_service()
    outline = ai_service.generate_outline(project_context)
"""

import logging
from threading import Lock
from typing import Optional
from flask import current_app, has_app_context
from .ai_service import AIService
from .ai_providers import (
    get_text_provider,
    get_image_provider,
    get_caption_provider,
    get_provider_cache_signature,
    TextProvider,
    ImageProvider,
)
from .runtime_settings import get_effective_config_value, has_runtime_settings_override

logger = logging.getLogger(__name__)

# Global singleton instance
_ai_service_instance: Optional[AIService] = None
_ai_service_signature: Optional[tuple] = None
_lock = Lock()

# Provider cache to avoid re-initialization when models don't change
_text_provider_cache: dict = {}
_image_provider_cache: dict = {}
_caption_provider_cache: dict = {}
_cache_lock = Lock()


def _get_cached_text_provider(model: str, signature: tuple) -> TextProvider:
    """
    Get or create a cached text provider instance
    
    Args:
        model: Model name to use
        
    Returns:
        Cached or new TextProvider instance
    """
    with _cache_lock:
        cache_key = (model, signature)
        if cache_key not in _text_provider_cache:
            logger.info(f"Creating new TextProvider for model: {model}, signature={signature[:2]}")
            _text_provider_cache[cache_key] = get_text_provider(model=model)
        else:
            logger.debug(f"Reusing cached TextProvider for model: {model}")
        return _text_provider_cache[cache_key]


def _get_cached_image_provider(model: str, signature: tuple) -> ImageProvider:
    """
    Get or create a cached image provider instance
    
    Args:
        model: Model name to use
        
    Returns:
        Cached or new ImageProvider instance
    """
    with _cache_lock:
        cache_key = (model, signature)
        if cache_key not in _image_provider_cache:
            logger.info(f"Creating new ImageProvider for model: {model}, signature={signature[:2]}")
            _image_provider_cache[cache_key] = get_image_provider(model=model)
        else:
            logger.debug(f"Reusing cached ImageProvider for model: {model}")
        return _image_provider_cache[cache_key]



def _get_cached_caption_provider(model: str, signature: tuple) -> TextProvider:
    """Get or create a cached caption provider instance"""
    with _cache_lock:
        cache_key = (model, signature)
        if cache_key not in _caption_provider_cache:
            logger.info(f"Creating new CaptionProvider for model: {model}, signature={signature[:2]}")
            _caption_provider_cache[cache_key] = get_caption_provider(model=model)
        return _caption_provider_cache[cache_key]


def get_ai_service(force_new: bool = False) -> AIService:
    """
    Get the singleton AIService instance with optimized provider caching
    
    This function creates and returns a singleton AIService instance that reuses
    AI providers (TextProvider and ImageProvider) across requests, significantly
    reducing initialization overhead.
    
    Args:
        force_new: If True, forces creation of a new instance (useful for testing)
        
    Returns:
        AIService singleton instance with cached providers
        
    Note:
        The providers are cached per model name. If TEXT_MODEL or IMAGE_MODEL
        changes in Flask config, new providers will be created automatically.
    """
    global _ai_service_instance, _ai_service_signature
    
    if force_new:
        with _lock:
            logger.info("Force creating new AIService instance")
            _ai_service_instance = None
    
    # Request/task scoped overrides must not reuse a process-wide singleton.
    if has_runtime_settings_override():
        text_model = get_effective_config_value("TEXT_MODEL")
        image_model = get_effective_config_value("IMAGE_MODEL")
        caption_model = get_effective_config_value("IMAGE_CAPTION_MODEL")
        signature = get_provider_cache_signature()
        text_provider = _get_cached_text_provider(text_model, signature)
        image_provider = _get_cached_image_provider(image_model, signature)
        caption_provider = _get_cached_caption_provider(caption_model, signature)
        logger.info(
            "Creating request-scoped AIService with models: text=%s, image=%s, caption=%s, signature=%s",
            text_model,
            image_model,
            caption_model,
            signature[:2],
        )
        return AIService(
            text_provider=text_provider,
            image_provider=image_provider,
            caption_provider=caption_provider,
        )

    current_signature = get_provider_cache_signature()

    if _ai_service_instance is None or _ai_service_signature != current_signature:
        with _lock:
            # Double-check locking pattern
            if _ai_service_instance is None or _ai_service_signature != current_signature:
                logger.info("Initializing AIService singleton with provider caching")
                
                text_model = get_effective_config_value("TEXT_MODEL")
                image_model = get_effective_config_value("IMAGE_MODEL")
                caption_model = get_effective_config_value("IMAGE_CAPTION_MODEL")
                # Get cached providers
                text_provider = _get_cached_text_provider(text_model, current_signature)
                image_provider = _get_cached_image_provider(image_model, current_signature)
                caption_provider = _get_cached_caption_provider(caption_model, current_signature)
                # Create AIService with cached providers
                _ai_service_instance = AIService(
                    text_provider=text_provider,
                    image_provider=image_provider,
                    caption_provider=caption_provider
                )
                _ai_service_signature = current_signature
                
                logger.info(
                    "AIService singleton created with models: text=%s, image=%s, caption=%s, signature=%s",
                    text_model,
                    image_model,
                    caption_model,
                    current_signature[:2],
                )
    
    return _ai_service_instance


def clear_ai_service_cache():
    """
    Clear the AIService singleton and provider cache
    
    This is useful when:
    - Configuration changes (API keys, endpoints, models)
    - Testing scenarios requiring fresh instances
    - Memory cleanup needed
    
    Note:
    - Uses nested locks to ensure atomic cache clearing operation
    - Prevents race conditions where new instances could be created
      with stale cached providers during the clearing process
    """
    global _ai_service_instance, _ai_service_signature
    
    with _lock:
        _ai_service_instance = None
        _ai_service_signature = None
        logger.info("AIService singleton cache cleared")
        with _cache_lock:
            _text_provider_cache.clear()
            _image_provider_cache.clear()
            _caption_provider_cache.clear()
            logger.info("Provider cache cleared")


def get_provider_cache_info() -> dict:
    """
    Get information about cached providers (for debugging/monitoring)
    
    Returns:
        Dictionary with cache statistics
    """
    with _cache_lock:
        return {
            "text_providers": list(_text_provider_cache.keys()),
            "image_providers": list(_image_provider_cache.keys()),
            "caption_providers": list(_caption_provider_cache.keys()),
            "total_cached": len(_text_provider_cache) + len(_image_provider_cache) + len(_caption_provider_cache)
        }
