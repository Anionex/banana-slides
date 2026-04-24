"""
AI Providers factory module

Provides factory functions to get the appropriate text/image generation providers
based on environment configuration.

Configuration priority (highest → lowest):
    1. Database settings (Flask app.config, persisted via Settings page)
    2. Environment variables (.env file)
    3. Hard-coded defaults

Supported provider formats:
    gemini    — Google AI Studio (API key auth)
    openai    — OpenAI-compatible endpoints
    anthropic — Anthropic (Claude) API
    vertex    — Google Cloud Vertex AI (service-account auth)
    lazyllm   — LazyLLM multi-vendor framework
"""
import os
import logging
from typing import Any, Dict, Optional

from .text import TextProvider, GenAITextProvider, OpenAITextProvider, AnthropicTextProvider, LazyLLMTextProvider
from .image import ImageProvider, GenAIImageProvider, OpenAIImageProvider, AnthropicImageProvider, LazyLLMImageProvider

logger = logging.getLogger(__name__)

__all__ = [
    'TextProvider', 'GenAITextProvider', 'OpenAITextProvider', 'AnthropicTextProvider', 'LazyLLMTextProvider',
    'ImageProvider', 'GenAIImageProvider', 'OpenAIImageProvider', 'AnthropicImageProvider', 'LazyLLMImageProvider',
    'get_text_provider', 'get_image_provider', 'get_provider_format',
    'get_caption_provider', 'get_image_caption_provider_config', 'LAZYLLM_VENDORS',
]

# LazyLLM vendor names (used to distinguish from gemini/openai formats)
LAZYLLM_VENDORS = {'qwen', 'doubao', 'deepseek', 'glm', 'siliconflow', 'sensenova', 'minimax', 'kimi'}


def get_provider_format() -> str:
    """
    Get the configured AI provider format

    Priority:
        1. Flask app.config['AI_PROVIDER_FORMAT'] (from database settings)
        2. Environment variable AI_PROVIDER_FORMAT
        3. Default: 'gemini'

    Returns:
        "gemini", "openai", "vertex", "lazyllm", or a lazyllm vendor name
        (e.g., "doubao", "qwen", "deepseek")
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


def _resolve_setting(
    key: str,
    fallback: Optional[str] = None,
    runtime_config: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """Look up a configuration value using the standard priority chain.

    Resolution order:
        1. Flask ``app.config`` (populated from the database Settings page)
        2. OS environment variable
        3. *fallback* argument (may be ``None``)
    """
    # 1) Explicit runtime_config overrides
    if runtime_config and key in runtime_config:
        val = runtime_config[key]
        if val is None and runtime_config.get('SETTINGS_SCOPE') == 'private':
            logger.debug("Setting %s explicitly unset in private runtime_config", key)
            return None
        if val is not None:
            logger.debug("Setting %s resolved from runtime_config", key)
            return str(val)

    # 2) Try Flask app.config
    try:
        from flask import current_app
        if current_app and hasattr(current_app, 'config') and key in current_app.config:
            val = current_app.config[key]
            if val is not None:
                logger.debug("Setting %s resolved from app.config", key)
                return str(val)
    except RuntimeError:
        pass  # outside Flask request context

    # 3) Try environment
    env_val = os.getenv(key)
    if env_val is not None:
        logger.debug("Setting %s resolved from environment", key)
        return env_val

    # 4) Fallback
    if fallback is not None:
        logger.debug("Setting %s using fallback: %s", key, fallback)
    return fallback


def _get_runtime_lazyllm_keys(runtime_config: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
    if not runtime_config:
        return {}
    keys = runtime_config.get('LAZYLLM_API_KEYS')
    if isinstance(keys, dict):
        return {str(vendor): str(key) for vendor, key in keys.items() if key}
    return {}


def _get_runtime_lazyllm_namespace(runtime_config: Optional[Dict[str, Any]] = None) -> str:
    if runtime_config and runtime_config.get('LAZYLLM_NAMESPACE'):
        return str(runtime_config['LAZYLLM_NAMESPACE'])
    return 'BANANA'


def _build_provider_config(runtime_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Assemble provider-specific configuration dict.

    Returns a dict always containing ``'format'`` plus format-specific keys:
        - gemini / openai / anthropic → ``api_key``, ``api_base``
        - vertex          → ``project_id``, ``location``
        - lazyllm         → ``text_source``, ``image_source``

    Raises ``ValueError`` when required settings are missing.
    """
    fmt = (
        _resolve_setting('AI_PROVIDER_FORMAT', runtime_config=runtime_config)
        or get_provider_format()
    )
    cfg: Dict[str, Any] = {'format': fmt}

    if fmt == 'openai':
        cfg['api_key'] = (
            _resolve_setting('OPENAI_API_KEY', runtime_config=runtime_config)
            or _resolve_setting('GOOGLE_API_KEY', runtime_config=runtime_config)
        )
        cfg['api_base'] = _resolve_setting(
            'OPENAI_API_BASE',
            'https://aihubmix.com/v1',
            runtime_config=runtime_config,
        )
        if not cfg['api_key']:
            raise ValueError(
                "OPENAI_API_KEY or GOOGLE_API_KEY (from database settings or environment) "
                "is required when AI_PROVIDER_FORMAT=openai."
            )
        logger.info("Provider config — format: openai, api_base: %s", cfg['api_base'])

    elif fmt == 'anthropic':
        cfg['api_key'] = (
            _resolve_setting('ANTHROPIC_API_KEY', runtime_config=runtime_config)
            or _resolve_setting('OPENAI_API_KEY', runtime_config=runtime_config)
        )
        cfg['api_base'] = _resolve_setting(
            'ANTHROPIC_API_BASE',
            'https://api.anthropic.com',
            runtime_config=runtime_config,
        )
        if not cfg['api_key']:
            raise ValueError(
                "ANTHROPIC_API_KEY (from database settings or environment) "
                "is required when AI_PROVIDER_FORMAT=anthropic."
            )
        logger.info("Provider config — format: anthropic, api_base: %s", cfg['api_base'])

    elif fmt == 'vertex':
        cfg['project_id'] = _resolve_setting('VERTEX_PROJECT_ID', runtime_config=runtime_config)
        cfg['location'] = _resolve_setting(
            'VERTEX_LOCATION',
            'us-central1',
            runtime_config=runtime_config,
        )
        if not cfg['project_id']:
            raise ValueError(
                "VERTEX_PROJECT_ID must be set when AI_PROVIDER_FORMAT=vertex. "
                "Make sure GOOGLE_APPLICATION_CREDENTIALS points to a valid service-account JSON."
            )
        logger.info("Provider config — format: vertex, project: %s, location: %s",
                     cfg['project_id'], cfg['location'])

    elif fmt in LAZYLLM_VENDORS or fmt == 'lazyllm':
        # fmt is a specific vendor (e.g., 'doubao') or generic 'lazyllm' (legacy)
        vendor = fmt if fmt in LAZYLLM_VENDORS else None
        cfg['format'] = 'lazyllm'
        cfg['text_source'] = (
            _resolve_setting('TEXT_MODEL_SOURCE', runtime_config=runtime_config)
            or vendor
            or 'deepseek'
        )
        cfg['image_source'] = (
            _resolve_setting('IMAGE_MODEL_SOURCE', runtime_config=runtime_config)
            or vendor
            or 'doubao'
        )
        cfg['lazyllm_api_keys'] = _get_runtime_lazyllm_keys(runtime_config)
        cfg['lazyllm_namespace'] = _get_runtime_lazyllm_namespace(runtime_config)
        logger.info("Provider config — format: lazyllm, vendor: %s, text_source: %s, image_source: %s",
                     vendor, cfg['text_source'], cfg['image_source'])

    else:
        # gemini (default) or unknown format
        if fmt != 'gemini':
            logger.warning("Unknown provider format '%s', falling back to gemini", fmt)
            cfg['format'] = 'gemini'
        cfg['api_key'] = _resolve_setting('GOOGLE_API_KEY', runtime_config=runtime_config)
        cfg['api_base'] = _resolve_setting('GOOGLE_API_BASE', runtime_config=runtime_config)
        if not cfg['api_key']:
            raise ValueError("GOOGLE_API_KEY (from database settings or environment) is required")
        logger.info("Provider config — format: gemini, api_base: %s, api_key: %s",
                     cfg['api_base'], '***' if cfg['api_key'] else 'None')

    return cfg


def _get_model_type_provider_config(
    model_type: str,
    runtime_config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Get provider config for a specific model type, with fallback to global config.

    Each model type (text, image, image_caption) can independently choose its provider
    via {MODEL_TYPE}_MODEL_SOURCE. The source can be:
      - 'gemini': uses {MODEL_TYPE}_API_KEY + {MODEL_TYPE}_API_BASE, fallback to global
      - 'openai': uses {MODEL_TYPE}_API_KEY + {MODEL_TYPE}_API_BASE, fallback to global
      - 'anthropic': uses {MODEL_TYPE}_API_KEY + {MODEL_TYPE}_API_BASE, fallback to global
      - A LazyLLM vendor name (qwen, doubao, etc.): uses lazyllm with that vendor
      - None/empty: falls back to global _build_provider_config()

    Args:
        model_type: "text", "image", or "image_caption"

    Returns:
        Dict with provider config (same format as _build_provider_config)
    """
    prefix = model_type.upper()  # TEXT, IMAGE, IMAGE_CAPTION
    source_key = f'{prefix}_MODEL_SOURCE'
    source = _resolve_setting(source_key, runtime_config=runtime_config)

    if not source:
        # No per-model override, use global config
        return _build_provider_config(runtime_config=runtime_config)

    source_lower = source.lower()

    if source_lower == 'gemini':
        api_key = (
            _resolve_setting(f'{prefix}_API_KEY', runtime_config=runtime_config)
            or _resolve_setting('GOOGLE_API_KEY', runtime_config=runtime_config)
        )
        api_base = (
            _resolve_setting(f'{prefix}_API_BASE', runtime_config=runtime_config)
            or _resolve_setting('GOOGLE_API_BASE', runtime_config=runtime_config)
        )
        if not api_key:
            raise ValueError(
                f"API key is required for {model_type} model with Gemini provider. "
                f"Set {prefix}_API_KEY or GOOGLE_API_KEY."
            )
        logger.info("Per-model config — %s: gemini, api_base: %s", model_type, api_base)
        return {'format': 'gemini', 'api_key': api_key, 'api_base': api_base}

    elif source_lower == 'openai':
        api_key = (
            _resolve_setting(f'{prefix}_API_KEY', runtime_config=runtime_config)
            or _resolve_setting('OPENAI_API_KEY', runtime_config=runtime_config)
            or _resolve_setting('GOOGLE_API_KEY', runtime_config=runtime_config)
        )
        api_base = (
            _resolve_setting(f'{prefix}_API_BASE', runtime_config=runtime_config)
            or _resolve_setting(
                'OPENAI_API_BASE',
                'https://aihubmix.com/v1',
                runtime_config=runtime_config,
            )
        )
        if not api_key:
            raise ValueError(
                f"API key is required for {model_type} model with OpenAI provider. "
                f"Set {prefix}_API_KEY or OPENAI_API_KEY."
            )
        logger.info("Per-model config — %s: openai, api_base: %s", model_type, api_base)
        return {'format': 'openai', 'api_key': api_key, 'api_base': api_base}

    elif source_lower == 'anthropic':
        api_key = (
            _resolve_setting(f'{prefix}_API_KEY', runtime_config=runtime_config)
            or _resolve_setting('ANTHROPIC_API_KEY', runtime_config=runtime_config)
            or _resolve_setting('OPENAI_API_KEY', runtime_config=runtime_config)
        )
        api_base = (
            _resolve_setting(f'{prefix}_API_BASE', runtime_config=runtime_config)
            or _resolve_setting(
                'ANTHROPIC_API_BASE',
                'https://api.anthropic.com',
                runtime_config=runtime_config,
            )
        )
        if not api_key:
            raise ValueError(
                f"API key is required for {model_type} model with Anthropic provider. "
                f"Set {prefix}_API_KEY or ANTHROPIC_API_KEY."
            )
        logger.info("Per-model config — %s: anthropic, api_base: %s", model_type, api_base)
        return {'format': 'anthropic', 'api_key': api_key, 'api_base': api_base}

    else:
        # Assume it's a LazyLLM vendor name
        logger.info("Per-model config — %s: lazyllm, source: %s", model_type, source_lower)
        return {
            'format': 'lazyllm',
            'source': source_lower,
            'api_key': _get_runtime_lazyllm_keys(runtime_config).get(source_lower),
            'namespace': _get_runtime_lazyllm_namespace(runtime_config),
        }


def get_image_caption_provider_config(runtime_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Get provider config specifically for image caption model."""
    return _get_model_type_provider_config('image_caption', runtime_config=runtime_config)


def get_caption_provider(
    model: str = "gemini-3-flash-preview",
    runtime_config: Optional[Dict[str, Any]] = None,
) -> TextProvider:
    """Factory: return a TextProvider for image caption (multimodal) tasks."""
    config = _get_model_type_provider_config('image_caption', runtime_config=runtime_config)
    fmt = config['format']

    if fmt == 'anthropic':
        logger.info("Caption provider: Anthropic, model=%s", model)
        return AnthropicTextProvider(api_key=config['api_key'], api_base=config['api_base'], model=model)
    elif fmt == 'openai':
        logger.info("Caption provider: OpenAI, model=%s", model)
        return OpenAITextProvider(api_key=config['api_key'], api_base=config['api_base'], model=model)
    elif fmt == 'vertex':
        logger.info("Caption provider: Vertex AI, model=%s", model)
        return GenAITextProvider(
            model=model, vertexai=True,
            project_id=config['project_id'], location=config['location'],
        )
    elif fmt == 'lazyllm':
        source = config.get('source') or config.get('text_source', 'doubao')
        namespace = config.get('namespace') or config.get('lazyllm_namespace') or _get_runtime_lazyllm_namespace(runtime_config)
        api_key = config.get('api_key') or _get_runtime_lazyllm_keys(runtime_config).get(source)
        logger.info("Caption provider: LazyLLM, model=%s, source=%s", model, source)
        return LazyLLMTextProvider(source=source, model=model, namespace=namespace, api_key=api_key)
    else:
        logger.info("Caption provider: Gemini, model=%s", model)
        return GenAITextProvider(api_key=config['api_key'], api_base=config['api_base'], model=model)


def get_text_provider(
    model: str = "gemini-3-flash-preview",
    runtime_config: Optional[Dict[str, Any]] = None,
) -> TextProvider:
    """Factory: return the appropriate text-generation provider."""
    config = _get_model_type_provider_config('text', runtime_config=runtime_config)
    fmt = config['format']

    if fmt == 'anthropic':
        logger.info("Text provider: Anthropic, model=%s", model)
        return AnthropicTextProvider(api_key=config['api_key'], api_base=config['api_base'], model=model)
    elif fmt == 'openai':
        logger.info("Text provider: OpenAI, model=%s", model)
        return OpenAITextProvider(api_key=config['api_key'], api_base=config['api_base'], model=model)
    elif fmt == 'vertex':
        logger.info("Text provider: Vertex AI, model=%s, project=%s", model, config['project_id'])
        return GenAITextProvider(
            model=model, vertexai=True,
            project_id=config['project_id'], location=config['location'],
        )
    elif fmt == 'lazyllm':
        source = config.get('source') or config.get('text_source', 'deepseek')
        namespace = config.get('namespace') or config.get('lazyllm_namespace') or _get_runtime_lazyllm_namespace(runtime_config)
        api_key = config.get('api_key') or _get_runtime_lazyllm_keys(runtime_config).get(source)
        logger.info("Text provider: LazyLLM, model=%s, source=%s", model, source)
        return LazyLLMTextProvider(source=source, model=model, namespace=namespace, api_key=api_key)
    else:
        # gemini (default)
        logger.info("Text provider: Gemini, model=%s", model)
        return GenAITextProvider(api_key=config['api_key'], api_base=config['api_base'], model=model)


def get_image_provider(
    model: str = "gemini-3-pro-image-preview",
    runtime_config: Optional[Dict[str, Any]] = None,
) -> ImageProvider:
    """Factory: return the appropriate image-generation provider.

    Note: OpenAI format does NOT support 4K resolution — only 1K is available.
    Use Gemini or Vertex AI for higher resolution output.

    Note: Anthropic format doesn't natively support image generation yet.
    This is intended for use with third-party Anthropic-compatible endpoints.
    """
    config = _get_model_type_provider_config('image', runtime_config=runtime_config)
    fmt = config['format']

    if fmt == 'anthropic':
        logger.info("Image provider: Anthropic, model=%s", model)
        logger.warning("Anthropic format is for compatible endpoints only (official API doesn't support image generation)")
        return AnthropicImageProvider(api_key=config['api_key'], api_base=config['api_base'], model=model)
    elif fmt == 'openai':
        logger.info("Image provider: OpenAI, model=%s", model)
        logger.warning("OpenAI format only supports 1K resolution, 4K is not available")
        return OpenAIImageProvider(api_key=config['api_key'], api_base=config['api_base'], model=model)
    elif fmt == 'vertex':
        logger.info("Image provider: Vertex AI, model=%s, project=%s", model, config['project_id'])
        return GenAIImageProvider(
            model=model, vertexai=True,
            project_id=config['project_id'], location=config['location'],
        )
    elif fmt == 'lazyllm':
        source = config.get('source') or config.get('image_source', 'doubao')
        namespace = config.get('namespace') or config.get('lazyllm_namespace') or _get_runtime_lazyllm_namespace(runtime_config)
        api_key = config.get('api_key') or _get_runtime_lazyllm_keys(runtime_config).get(source)
        logger.info("Image provider: LazyLLM, model=%s, source=%s", model, source)
        return LazyLLMImageProvider(source=source, model=model, namespace=namespace, api_key=api_key)
    else:
        # gemini (default)
        logger.info("Image provider: Gemini, model=%s", model)
        return GenAIImageProvider(api_key=config['api_key'], api_base=config['api_base'], model=model)
