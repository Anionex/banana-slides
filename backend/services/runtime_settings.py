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
from dataclasses import dataclass
from enum import Enum
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


def get_default_settings_source():
    """
    Return the canonical site-default settings source.

    The global Settings row is the only canonical site-default source. User
    settings are sparse per-user overrides and do not participate in default
    fallback arbitration.
    """
    from models import Settings
    return Settings.get_settings()


def _get_user_editable_fields() -> set[str]:
    """Get the set of fields a non-admin user is allowed to override."""
    try:
        from models import SystemConfig
        config = SystemConfig.get_instance()
        return set(config.get_user_editable_fields())
    except Exception:
        return {"output_language", "image_resolution", "image_aspect_ratio"}


@dataclass
class EffectiveSettingsResult:
    """Result of settings resolution with per-field source tracking."""
    override: Dict[str, object]
    field_sources: Dict[str, str]  # field_name -> "user" | "platform"


def build_effective_settings_override(
    user_id: str | None = None,
    *,
    _return_sources: bool = False,
) -> Dict[str, object] | EffectiveSettingsResult:
    """
    Build the effective runtime settings for a request/task.

    Priority:
    1. UserSettings field value (only if field is in admin-allowed editable set)
    2. Global Settings
    3. .env / Config only indirectly, via Settings initialization/reset

    When *_return_sources* is True, returns an ``EffectiveSettingsResult``
    that also carries per-field source information (``"user"`` vs
    ``"platform"``).  The default (False) keeps the original return type
    for backward-compat.
    """
    from models import UserSettings

    default_settings = get_default_settings_source()

    if not user_id:
        logger.info("Building runtime settings override from default site settings source")
        override = _settings_row_to_runtime_override(default_settings)
        if _return_sources:
            return EffectiveSettingsResult(
                override=override,
                field_sources={f: "platform" for f in _SETTINGS_FIELDS},
            )
        return override

    user_settings = UserSettings.get_or_create_for_user(user_id)

    # Admin users are unrestricted; for regular users, honour editable_fields.
    from models import User
    user = User.query.get(user_id)
    is_admin = user.is_admin if user else False
    editable_fields = None if is_admin else _get_user_editable_fields()

    effective_values: Dict[str, object] = {}
    field_sources: Dict[str, str] = {}

    for field in _SETTINGS_FIELDS:
        user_value = getattr(user_settings, field)
        default_value = getattr(default_settings, field)

        # If the field is not editable for this user, ignore user's value
        use_user = (
            user_value is not None
            and (editable_fields is None or field in editable_fields)
        )

        if use_user:
            effective_values[field] = user_value
            field_sources[field] = "user"
        else:
            effective_values[field] = default_value
            field_sources[field] = "platform"

    class _Merged:
        pass

    merged = _Merged()
    for field, value in effective_values.items():
        setattr(merged, field, value)

    logger.info(
        "Built effective runtime settings for user %s (editable: %s)",
        user_id,
        "all" if editable_fields is None else sorted(editable_fields),
    )

    override = _settings_row_to_runtime_override(merged)
    if _return_sources:
        return EffectiveSettingsResult(override=override, field_sources=field_sources)
    return override


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


# ---------------------------------------------------------------------------
# Credential source arbitration
# ---------------------------------------------------------------------------

class ServiceType(Enum):
    """Service types that consume third-party API credentials."""
    TEXT_MODEL = "text_model"
    IMAGE_MODEL = "image_model"
    CAPTION_MODEL = "caption_model"
    MINERU = "mineru"
    BAIDU_OCR = "baidu_ocr"


# Maps each service to the UserSettings / Settings field holding its credential.
_SERVICE_CREDENTIAL_FIELDS: Dict[ServiceType, str] = {
    ServiceType.TEXT_MODEL: "api_key",
    ServiceType.IMAGE_MODEL: "api_key",
    ServiceType.CAPTION_MODEL: "api_key",
    ServiceType.MINERU: "mineru_token",
    ServiceType.BAIDU_OCR: "baidu_api_key",
}


def is_user_owned_credential(user_id: str, service_type: ServiceType) -> bool:
    """
    Check whether the effective credential for *service_type* belongs to the
    user (True) or the platform (False).

    Delegates to ``build_effective_settings_override`` so that editable-field
    restrictions and value resolution happen in one place.
    """
    field_name = _SERVICE_CREDENTIAL_FIELDS[service_type]
    result = build_effective_settings_override(user_id, _return_sources=True)
    return result.field_sources.get(field_name) == "user"
