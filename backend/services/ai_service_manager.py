"""
AI service cache and runtime-config helpers.

This module supports both:
- the legacy/global app-level AI configuration
- user-scoped runtime AI configuration for isolated private settings
"""

import logging
from threading import Lock
from typing import Any, Optional

from flask import current_app, has_app_context

from .ai_service import AIService

logger = logging.getLogger(__name__)

_ai_service_cache: dict[tuple, AIService] = {}
_lock = Lock()

_RUNTIME_CONFIG_KEYS = (
    "AI_PROVIDER_FORMAT",
    "GOOGLE_API_KEY",
    "OPENAI_API_KEY",
    "GOOGLE_API_BASE",
    "OPENAI_API_BASE",
    "TEXT_MODEL",
    "IMAGE_MODEL",
    "IMAGE_CAPTION_MODEL",
    "OUTPUT_LANGUAGE",
    "DEFAULT_RESOLUTION",
    "DEFAULT_ASPECT_RATIO",
    "MAX_DESCRIPTION_WORKERS",
    "MAX_IMAGE_WORKERS",
    "DESCRIPTION_EXTRA_FIELDS",
    "IMAGE_PROMPT_EXTRA_FIELDS",
    "ENABLE_TEXT_REASONING",
    "TEXT_THINKING_BUDGET",
    "ENABLE_IMAGE_REASONING",
    "IMAGE_THINKING_BUDGET",
    "MINERU_API_BASE",
    "MINERU_TOKEN",
    "BAIDU_API_KEY",
    "TEXT_MODEL_SOURCE",
    "IMAGE_MODEL_SOURCE",
    "IMAGE_CAPTION_MODEL_SOURCE",
    "TEXT_API_KEY",
    "TEXT_API_BASE",
    "IMAGE_API_KEY",
    "IMAGE_API_BASE",
    "IMAGE_CAPTION_API_KEY",
    "IMAGE_CAPTION_API_BASE",
    "LAZYLLM_NAMESPACE",
    "SETTINGS_SCOPE",
    "SETTINGS_OWNER_USER_ID",
)


def _freeze(value: Any):
    if isinstance(value, dict):
        return tuple((str(k), _freeze(v)) for k, v in sorted(value.items(), key=lambda item: str(item[0])))
    if isinstance(value, (list, tuple, set)):
        return tuple(_freeze(v) for v in value)
    return value


def _normalize_runtime_config(runtime_config: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    if runtime_config is None:
        from config import get_config

        config = get_config()
        normalized: dict[str, Any] = {}
        for key in _RUNTIME_CONFIG_KEYS:
            fallback = getattr(config, key, None)
            if has_app_context() and current_app and hasattr(current_app, "config"):
                normalized[key] = current_app.config.get(key, fallback)
            else:
                normalized[key] = fallback
        normalized["LAZYLLM_API_KEYS"] = {}
        normalized.setdefault("LAZYLLM_NAMESPACE", "BANANA")
        return normalized

    normalized = dict(runtime_config)
    normalized.setdefault("LAZYLLM_API_KEYS", {})
    normalized.setdefault("LAZYLLM_NAMESPACE", "BANANA")
    return normalized


def _runtime_config_cache_key(runtime_config: dict[str, Any]) -> tuple:
    return _freeze(runtime_config)


def get_runtime_config_for_user(user=None) -> dict[str, Any]:
    from models import Settings

    settings = Settings.get_settings(user)
    include_secret_defaults = not (
        user is not None
        and hasattr(user, "uses_private_runtime_settings")
        and user.uses_private_runtime_settings()
    )
    return settings.to_runtime_config(include_secret_defaults=include_secret_defaults)


def get_runtime_config_for_user_id(user_id: Optional[str]) -> dict[str, Any]:
    from models import User

    if not user_id:
        return get_runtime_config_for_user(None)

    user = User.query.get(user_id)
    if not user or not user.is_active:
        return get_runtime_config_for_user(None)
    return get_runtime_config_for_user(user)


def get_ai_service(force_new: bool = False, runtime_config: Optional[dict[str, Any]] = None) -> AIService:
    normalized_runtime_config = _normalize_runtime_config(runtime_config)
    cache_key = _runtime_config_cache_key(normalized_runtime_config)

    with _lock:
        if force_new and cache_key in _ai_service_cache:
            logger.info("Force clearing AIService cache entry")
            _ai_service_cache.pop(cache_key, None)

        if cache_key not in _ai_service_cache:
            logger.info("Creating AIService for runtime scope=%s owner=%s",
                        normalized_runtime_config.get("SETTINGS_SCOPE"),
                        normalized_runtime_config.get("SETTINGS_OWNER_USER_ID"))
            _ai_service_cache[cache_key] = AIService(runtime_config=normalized_runtime_config)

        return _ai_service_cache[cache_key]


def get_ai_service_for_user(user=None, force_new: bool = False) -> AIService:
    return get_ai_service(
        force_new=force_new,
        runtime_config=get_runtime_config_for_user(user),
    )


def get_ai_service_for_user_id(user_id: Optional[str], force_new: bool = False) -> AIService:
    return get_ai_service(
        force_new=force_new,
        runtime_config=get_runtime_config_for_user_id(user_id),
    )


def clear_ai_service_cache():
    with _lock:
        _ai_service_cache.clear()
        logger.info("AIService cache cleared")


def get_provider_cache_info() -> dict:
    with _lock:
        return {
            "service_cache_entries": len(_ai_service_cache),
            "cache_keys": [str(key[:4]) for key in _ai_service_cache.keys()],
        }
