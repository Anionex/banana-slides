"""
Runtime settings helpers.

This module provides request/task-scoped settings overrides so AI runtime
configuration can safely differ per user without mutating global app.config.
"""

from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Dict, Optional

logger = logging.getLogger(__name__)

_runtime_settings_override: ContextVar[Optional[Dict[str, object]]] = ContextVar(
    "runtime_settings_override",
    default=None,
)

_SETTINGS_FIELDS = [
    "ai_provider_format",
    "api_base_url",
    "api_key",
    "text_model",
    "image_model",
    "image_caption_model",
    "mineru_api_base",
    "mineru_token",
    "image_resolution",
    "image_aspect_ratio",
    "max_description_workers",
    "max_image_workers",
    "output_language",
    "enable_text_reasoning",
    "text_thinking_budget",
    "enable_image_reasoning",
    "image_thinking_budget",
    "baidu_api_key",
]

_NULLABLE_FIELDS = {
    "api_base_url",
    "api_key",
    "text_model",
    "image_model",
    "image_caption_model",
    "mineru_api_base",
    "mineru_token",
    "baidu_api_key",
}

_CONFIG_ATTR_BY_KEY = {
    "AI_PROVIDER_FORMAT": "AI_PROVIDER_FORMAT",
    "GOOGLE_API_BASE": "GOOGLE_API_BASE",
    "OPENAI_API_BASE": "OPENAI_API_BASE",
    "GOOGLE_API_KEY": "GOOGLE_API_KEY",
    "OPENAI_API_KEY": "OPENAI_API_KEY",
    "TEXT_MODEL": "TEXT_MODEL",
    "IMAGE_MODEL": "IMAGE_MODEL",
    "IMAGE_CAPTION_MODEL": "IMAGE_CAPTION_MODEL",
    "MINERU_API_BASE": "MINERU_API_BASE",
    "MINERU_TOKEN": "MINERU_TOKEN",
    "DEFAULT_RESOLUTION": "DEFAULT_RESOLUTION",
    "DEFAULT_ASPECT_RATIO": "DEFAULT_ASPECT_RATIO",
    "MAX_DESCRIPTION_WORKERS": "MAX_DESCRIPTION_WORKERS",
    "MAX_IMAGE_WORKERS": "MAX_IMAGE_WORKERS",
    "OUTPUT_LANGUAGE": "OUTPUT_LANGUAGE",
    "ENABLE_TEXT_REASONING": "ENABLE_TEXT_REASONING",
    "TEXT_THINKING_BUDGET": "TEXT_THINKING_BUDGET",
    "ENABLE_IMAGE_REASONING": "ENABLE_IMAGE_REASONING",
    "IMAGE_THINKING_BUDGET": "IMAGE_THINKING_BUDGET",
    "BAIDU_API_KEY": "BAIDU_API_KEY",
    "VERTEX_PROJECT_ID": "VERTEX_PROJECT_ID",
    "VERTEX_LOCATION": "VERTEX_LOCATION",
    "IMAGE_CAPTION_MODEL_SOURCE": "IMAGE_CAPTION_MODEL_SOURCE",
}

_SETTINGS_FIELD_TO_RUNTIME_KEY = {
    "ai_provider_format": "AI_PROVIDER_FORMAT",
    "api_base_url": "GOOGLE_API_BASE",
    "api_key": "GOOGLE_API_KEY",
    "text_model": "TEXT_MODEL",
    "image_model": "IMAGE_MODEL",
    "image_caption_model": "IMAGE_CAPTION_MODEL",
    "mineru_api_base": "MINERU_API_BASE",
    "mineru_token": "MINERU_TOKEN",
    "image_resolution": "DEFAULT_RESOLUTION",
    "image_aspect_ratio": "DEFAULT_ASPECT_RATIO",
    "max_description_workers": "MAX_DESCRIPTION_WORKERS",
    "max_image_workers": "MAX_IMAGE_WORKERS",
    "output_language": "OUTPUT_LANGUAGE",
    "enable_text_reasoning": "ENABLE_TEXT_REASONING",
    "text_thinking_budget": "TEXT_THINKING_BUDGET",
    "enable_image_reasoning": "ENABLE_IMAGE_REASONING",
    "image_thinking_budget": "IMAGE_THINKING_BUDGET",
    "baidu_api_key": "BAIDU_API_KEY",
}


def get_runtime_settings_override() -> Optional[Dict[str, object]]:
    return _runtime_settings_override.get()


def get_runtime_config_value(key: str, default=None):
    override = get_runtime_settings_override()
    if override and key in override:
        value = override[key]
        if value is not None:
            return value
    return default


def get_effective_config_value(key: str, default=None):
    """
    Read one runtime config value through the unified precedence chain:
    request/task override > app.config > Config/env > explicit default.
    """
    override = get_runtime_settings_override()
    if override and key in override:
        value = override[key]
        if value is not None:
            return value

    try:
        from flask import current_app

        if current_app and hasattr(current_app, "config") and key in current_app.config:
            value = current_app.config.get(key)
            if value is not None:
                return value
    except RuntimeError:
        pass

    config_attr = _CONFIG_ATTR_BY_KEY.get(key)
    if config_attr:
        try:
            from config import get_config

            config = get_config()
            value = getattr(config, config_attr, None)
            if value is not None:
                return value
        except Exception:
            logger.debug("Failed to read config fallback for %s", key, exc_info=True)

    env_value = os.getenv(key)
    if env_value is not None:
        return env_value

    return default


def get_user_effective_config_value(user_id: str | None, key: str, default=None):
    """
    Read one config value using the full precedence chain for a specific user:
    user overrides > global settings > app/config/env defaults.
    """
    if not user_id:
        return get_effective_config_value(key, default=default)

    override = build_effective_settings_override(user_id)
    if key in override:
        value = override[key]
        if value is not None:
            return value

    return get_effective_config_value(key, default=default)


def build_effective_settings_payload(user_id: str | None = None) -> Dict[str, object]:
    """
    Return effective settings in Settings/UserSettings field names.
    Useful when callers need one canonical payload instead of re-implementing
    user/global/default arbitration themselves.
    """
    payload = {}
    for field_name, runtime_key in _SETTINGS_FIELD_TO_RUNTIME_KEY.items():
        if user_id:
            value = get_user_effective_config_value(user_id, runtime_key)
        else:
            value = get_effective_config_value(runtime_key)
        payload[field_name] = value
    return payload


def build_file_parser_config(user_id: str | None = None) -> Dict[str, object]:
    """
    Build FileParserService kwargs from the unified runtime settings source.
    """
    getter = (
        (lambda key, default=None: get_user_effective_config_value(user_id, key, default))
        if user_id
        else get_effective_config_value
    )
    return {
        "mineru_token": getter("MINERU_TOKEN", ""),
        "mineru_api_base": getter("MINERU_API_BASE", "https://mineru.net"),
        "google_api_key": getter("GOOGLE_API_KEY", ""),
        "google_api_base": getter("GOOGLE_API_BASE", ""),
        "openai_api_key": getter("OPENAI_API_KEY", ""),
        "openai_api_base": getter("OPENAI_API_BASE", ""),
        "image_caption_model": getter("IMAGE_CAPTION_MODEL", "gemini-3-flash-preview"),
        "provider_format": getter("AI_PROVIDER_FORMAT", "gemini"),
        "lazyllm_image_caption_source": getter("IMAGE_CAPTION_MODEL_SOURCE", "doubao"),
    }


def has_runtime_settings_override() -> bool:
    return get_runtime_settings_override() is not None


def _settings_row_to_runtime_override(settings_row) -> Dict[str, object]:
    return {
        "AI_PROVIDER_FORMAT": settings_row.ai_provider_format,
        "GOOGLE_API_BASE": settings_row.api_base_url,
        "OPENAI_API_BASE": settings_row.api_base_url,
        "GOOGLE_API_KEY": settings_row.api_key,
        "OPENAI_API_KEY": settings_row.api_key,
        "TEXT_MODEL": settings_row.text_model,
        "IMAGE_MODEL": settings_row.image_model,
        "IMAGE_CAPTION_MODEL": settings_row.image_caption_model,
        "MINERU_API_BASE": settings_row.mineru_api_base,
        "MINERU_TOKEN": settings_row.mineru_token,
        "DEFAULT_RESOLUTION": settings_row.image_resolution,
        "DEFAULT_ASPECT_RATIO": settings_row.image_aspect_ratio,
        "MAX_DESCRIPTION_WORKERS": settings_row.max_description_workers,
        "MAX_IMAGE_WORKERS": settings_row.max_image_workers,
        "OUTPUT_LANGUAGE": settings_row.output_language,
        "ENABLE_TEXT_REASONING": settings_row.enable_text_reasoning,
        "TEXT_THINKING_BUDGET": settings_row.text_thinking_budget,
        "ENABLE_IMAGE_REASONING": settings_row.enable_image_reasoning,
        "IMAGE_THINKING_BUDGET": settings_row.image_thinking_budget,
        "BAIDU_API_KEY": settings_row.baidu_api_key,
    }


def build_effective_settings_override(user_id: str | None = None) -> Dict[str, object]:
    """
    Build the effective runtime settings for a request/task.

    Priority:
    1. UserSettings (when user_id is provided)
    2. Global Settings
    3. .env / Config only indirectly, via Settings initialization/reset
    """
    from models import UserSettings

    default_settings = get_default_settings_source()

    if not user_id:
        logger.info("Building runtime settings override from default site settings source")
        return _settings_row_to_runtime_override(default_settings)

    user_settings = UserSettings.get_or_create_for_user(user_id)
    effective_values = {}

    for field in _SETTINGS_FIELDS:
        user_value = getattr(user_settings, field)
        global_value = getattr(default_settings, field)
        if field in _NULLABLE_FIELDS and user_value is None:
            effective_values[field] = global_value
        else:
            effective_values[field] = user_value

    class EffectiveSettings:
        pass

    merged = EffectiveSettings()
    for field, value in effective_values.items():
        setattr(merged, field, value)

    logger.info(
        "Built effective runtime settings for user %s with fallback-to-global for nullable fields",
        user_id,
    )

    return _settings_row_to_runtime_override(merged)


def _summarize_override(override: Dict[str, object]) -> str:
    provider = override.get("AI_PROVIDER_FORMAT") or "gemini"
    api_base = override.get("GOOGLE_API_BASE") or override.get("OPENAI_API_BASE") or ""
    text_model = override.get("TEXT_MODEL") or ""
    image_model = override.get("IMAGE_MODEL") or ""
    api_key = override.get("GOOGLE_API_KEY") or override.get("OPENAI_API_KEY") or ""
    key_len = len(str(api_key)) if api_key else 0
    return (
        f"provider={provider}, api_base={api_base}, api_key_length={key_len}, "
        f"text_model={text_model}, image_model={image_model}"
    )


@contextmanager
def use_settings_override(override: Dict[str, object], scope: str = ""):
    token = _runtime_settings_override.set(dict(override))
    logger.info(
        "Applied runtime settings override%s: %s",
        f" for {scope}" if scope else "",
        _summarize_override(override),
    )
    try:
        yield override
    finally:
        _runtime_settings_override.reset(token)


@contextmanager
def use_user_settings(user_id: str | None, scope: str = ""):
    override = build_effective_settings_override(user_id)
    with use_settings_override(override, scope=scope):
        yield override
