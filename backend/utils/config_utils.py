"""
User-aware configuration utility.

Provides get_user_config() that resolves per-user settings
from g.user_settings (request-scoped) with fallback to
current_app.config (startup defaults) and then env vars.

Thread-safe: g is per-app-context; current_app.config is only
read (never mutated per-request).
"""
import os
from typing import Any

_SENSITIVE_KEYS = {
    'GOOGLE_API_KEY',
    'OPENAI_API_KEY',
    'MINERU_TOKEN',
    'BAIDU_API_KEY',
    'BAIDU_OCR_API_KEY',
}


def _has_explicit_value(value: Any) -> bool:
    """Treat None/empty string as not configured so callers can fall back safely."""
    return value is not None and not (isinstance(value, str) and value == "")

# Mapping: Flask config key -> Settings model attribute name
_CONFIG_KEY_TO_SETTINGS_ATTR = {
    'AI_PROVIDER_FORMAT': 'ai_provider_format',
    'GOOGLE_API_KEY': 'api_key',
    'OPENAI_API_KEY': 'api_key',
    'GOOGLE_API_BASE': 'api_base_url',
    'OPENAI_API_BASE': 'api_base_url',
    'TEXT_MODEL': 'text_model',
    'IMAGE_MODEL': 'image_model',
    'IMAGE_CAPTION_MODEL': 'image_caption_model',
    'MINERU_API_BASE': 'mineru_api_base',
    'MINERU_TOKEN': 'mineru_token',
    'OUTPUT_LANGUAGE': 'output_language',
    'MAX_DESCRIPTION_WORKERS': 'max_description_workers',
    'MAX_IMAGE_WORKERS': 'max_image_workers',
    'DEFAULT_RESOLUTION': 'image_resolution',
    'DEFAULT_ASPECT_RATIO': 'image_aspect_ratio',
    'ENABLE_TEXT_REASONING': 'enable_text_reasoning',
    'TEXT_THINKING_BUDGET': 'text_thinking_budget',
    'ENABLE_IMAGE_REASONING': 'enable_image_reasoning',
    'IMAGE_THINKING_BUDGET': 'image_thinking_budget',
    'BAIDU_API_KEY': 'baidu_ocr_api_key',
    'BAIDU_OCR_API_KEY': 'baidu_ocr_api_key',
}


def get_user_config(key: str, default: Any = None) -> Any:
    """
    Get a config value with per-user isolation.

    Resolution order:
      1. g.user_settings (per-request, set by middleware or temporary_settings_override)
      2. current_app.config (startup defaults from .env/DB)
      3. os.environ
      4. default parameter

    Args:
        key: Config key name (e.g. 'GOOGLE_API_KEY', 'TEXT_MODEL')
        default: Fallback value if not found anywhere

    Returns:
        The resolved config value
    """
    # Step 1: Try g.user_settings (per-app-context, thread-safe)
    settings_attr = _CONFIG_KEY_TO_SETTINGS_ATTR.get(key)

    if settings_attr:
        try:
            from flask import g, has_app_context
            if has_app_context() and hasattr(g, 'user_settings') and g.user_settings is not None:
                value = getattr(g.user_settings, settings_attr, None)
                if _has_explicit_value(value):
                    return value
        except RuntimeError:
            pass

    # Step 2: Sensitive keys only fall back to .env, never to app.config.
    if key not in _SENSITIVE_KEYS:
        try:
            from flask import current_app, has_app_context
            if has_app_context() and current_app and hasattr(current_app, 'config'):
                if key in current_app.config:
                    value = current_app.config[key]
                    if _has_explicit_value(value):
                        return value
        except RuntimeError:
            pass

    # Step 3: Try environment variable
    env_value = os.getenv(key)
    if _has_explicit_value(env_value):
        return env_value

    # Step 4: Default
    return default
