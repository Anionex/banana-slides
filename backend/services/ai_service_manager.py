"""
AIService manager for AI provider initialization

This module provides AIService instances with proper configuration
based on the current request's user settings.

In multi-user mode (when X-User-Token is present), each request gets
a fresh AIService instance with the user's own API key and settings.

Usage:
    from services.ai_service_manager import get_ai_service

    # In your controller
    ai_service = get_ai_service()
    outline = ai_service.generate_outline(project_context)
"""

import logging
from .ai_service import AIService
from .ai_providers import get_text_provider, get_image_provider, TextProvider, ImageProvider

logger = logging.getLogger(__name__)


def get_ai_service(force_new: bool = False) -> AIService:
    """
    Get an AIService instance configured for the current user

    In multi-user mode (when user settings are loaded via middleware),
    this creates a fresh AIService instance using the user's configuration.
    This ensures each user's API key and settings are used correctly.

    Args:
        force_new: Ignored, kept for backward compatibility

    Returns:
        AIService instance configured for the current user
    """
    # Get model names with per-user isolation
    from config import get_config
    from utils.config_utils import get_user_config
    config = get_config()

    text_model = get_user_config("TEXT_MODEL", config.TEXT_MODEL)
    image_model = get_user_config("IMAGE_MODEL", config.IMAGE_MODEL)

    # Always create fresh providers to use current user's API key
    # Per-user settings are resolved via get_user_config() inside provider factories
    logger.debug(f"Creating AIService with models: text={text_model}, image={image_model}")

    text_provider = get_text_provider(model=text_model)
    image_provider = get_image_provider(model=image_model)

    return AIService(
        text_provider=text_provider,
        image_provider=image_provider
    )


def clear_ai_service_cache():
    """
    Clear AI service cache (no-op in multi-user mode)

    Kept for backward compatibility. In multi-user mode, there's no
    global cache to clear since each request gets a fresh instance.
    """
    logger.debug("clear_ai_service_cache called (no-op in multi-user mode)")


def get_provider_cache_info() -> dict:
    """
    Get information about cached providers (for debugging/monitoring)

    Returns:
        Dictionary with cache statistics (empty in multi-user mode)
    """
    return {
        "text_providers": [],
        "image_providers": [],
        "total_cached": 0,
        "mode": "multi-user (no caching)"
    }
