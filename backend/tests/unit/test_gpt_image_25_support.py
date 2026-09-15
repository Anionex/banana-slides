"""gpt-image-2.5 routing, quality tiers and reference limits.

gpt-image-2.5 ships as two model ids (gpt-image-2.5-flare / -sunburst) and adds
the xhigh / max quality tiers. These tests pin the provider behavior that makes
those ids work without changing any other model's request shape.
"""
import base64
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from services.ai_providers.image.openai_provider import (
    OpenAIImageProvider,
    _gpt_image_supports_extended_quality,
    _is_gpt_image_model,
)


def _png_data_url(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"


def _b64_png() -> str:
    buffer = BytesIO()
    Image.new("RGB", (8, 8), color="white").save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()


def _raw_response(payload):
    raw = MagicMock()
    raw.json.return_value = payload
    return raw


def _provider(model="gpt-image-2.5-flare", protocol="auto", quality="auto",
              client=None, api_base="https://api.openai.com/v1"):
    with patch("services.ai_providers.image.openai_provider.OpenAI"):
        provider = OpenAIImageProvider(
            api_key="test",
            api_base=api_base,
            model=model,
            image_api_protocol=protocol,
            image_quality=quality,
        )
    if client is not None:
        provider.client = client
    return provider


# ---------------------------------------------------------------------------
# Model family detection
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    ("model", "expected"),
    [
        ("gpt-image-1", True),
        ("gpt-image-1.5", True),
        ("gpt-image-2", True),
        ("gpt-image-2.5-flare", True),
        ("gpt-image-2.5-sunburst", True),
        ("gpt-image-2.5-flare-2026-09-08", True),
        ("GPT-IMAGE-2.5-FLARE", True),
        ("chatgpt-image-latest", True),
        ("gemini-3-pro-image-preview", False),
        ("dall-e-3", False),
        ("doubao-seedream-5.0-lite", False),
        ("", False),
        (None, False),
    ],
)
def test_is_gpt_image_model_matches_family_by_prefix(model, expected):
    assert _is_gpt_image_model(model) is expected


@pytest.mark.parametrize(
    ("model", "expected"),
    [
        ("gpt-image-2.5-flare", True),
        ("gpt-image-2.5-sunburst", True),
        ("gpt-image-2.5-flare-2026-09-08", True),
        ("gpt-image-3", True),
        ("gpt-image-2", False),
        ("gpt-image-2.4", False),
        ("gpt-image-1.5", False),
        ("chatgpt-image-latest", False),
    ],
)
def test_extended_quality_support_starts_at_2_5(model, expected):
    assert _gpt_image_supports_extended_quality(model) is expected


@pytest.mark.parametrize("model", ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "chatgpt-image-latest"])
def test_native_images_api_detection_covers_25_ids(model):
    assert _provider(model=model)._is_native_images_api_model() is True


def test_gpt_image_25_auto_protocol_uses_images_api():
    """Regression: 2.5 ids must not fall back to chat.completions."""
    client = MagicMock()
    client.images.with_raw_response.generate.return_value = _raw_response(
        {"data": [{"b64_json": _b64_png()}]}
    )
    provider = _provider(client=client)

    result = provider.generate_image("a cat", aspect_ratio="16:9", resolution="2K")

    assert isinstance(result, Image.Image)
    client.chat.completions.create.assert_not_called()
    request = client.images.with_raw_response.generate.call_args.kwargs
    assert request["model"] == "gpt-image-2.5-flare"
    assert request["size"] == "2048x1152"
    assert request["quality"] == "auto"


def test_gpt_image_25_edit_path_keeps_reference_images():
    client = MagicMock()
    client.images.with_raw_response.edit.return_value = _raw_response(
        {"data": [{"b64_json": _b64_png()}]}
    )
    provider = _provider(client=client)

    result = provider.generate_image(
        "keep the layout, replace the photo",
        ref_images=[Image.new("RGB", (64, 64), color="white")],
        aspect_ratio="1:1",
        resolution="1K",
    )

    assert isinstance(result, Image.Image)
    client.chat.completions.create.assert_not_called()
    assert client.images.with_raw_response.edit.call_args.kwargs["model"] == "gpt-image-2.5-flare"


def test_gpt_image_25_rejects_more_than_sixteen_references():
    client = MagicMock()
    provider = _provider(client=client)

    with pytest.raises(Exception, match="supports at most 16 reference images, got 17"):
        provider.generate_image(
            "merge everything",
            ref_images=[Image.new("RGB", (8, 8), color="white") for _ in range(17)],
            aspect_ratio="1:1",
            resolution="1K",
        )

    client.images.with_raw_response.edit.assert_not_called()
    client.images.with_raw_response.generate.assert_not_called()


# ---------------------------------------------------------------------------
# Quality tiers
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    ("model", "quality", "expected"),
    [
        ("gpt-image-2.5-flare", "auto", "auto"),
        ("gpt-image-2.5-flare", "low", "low"),
        ("gpt-image-2.5-flare", "medium", "medium"),
        ("gpt-image-2.5-flare", "high", "high"),
        ("gpt-image-2.5-flare", "xhigh", "xhigh"),
        ("gpt-image-2.5-flare", "max", "max"),
        ("gpt-image-2.5-sunburst", "max", "max"),
        ("gpt-image-2.5-flare", "MAX", "max"),
        ("gpt-image-3", "max", "max"),
        ("gpt-image-2", "high", "high"),
        ("gpt-image-2", "xhigh", "high"),
        ("gpt-image-2", "max", "high"),
        ("gpt-image-1.5", "max", "high"),
        ("chatgpt-image-latest", "xhigh", "high"),
        ("gpt-image-2.5-flare", "bogus", "auto"),
        ("gpt-image-2.5-flare", "", "auto"),
        ("dall-e-3", "max", "standard"),
        ("dall-e-2", "high", None),
        ("doubao-seedream-5.0-lite", "high", None),
    ],
)
def test_resolve_quality_per_model(model, quality, expected):
    assert _provider(model=model, quality=quality)._resolve_quality() == expected


def test_gpt_image_25_native_request_forwards_extended_quality():
    client = MagicMock()
    client.images.with_raw_response.generate.return_value = _raw_response(
        {"data": [{"b64_json": _b64_png()}]}
    )
    provider = _provider(quality="max", client=client)

    provider.generate_image("a poster", aspect_ratio="1:1", resolution="2K")

    assert client.images.with_raw_response.generate.call_args.kwargs["quality"] == "max"


def test_older_model_request_clamps_extended_quality():
    client = MagicMock()
    client.images.with_raw_response.generate.return_value = _raw_response(
        {"data": [{"b64_json": _b64_png()}]}
    )
    provider = _provider(model="gpt-image-2", quality="max", client=client)

    provider.generate_image("a poster", aspect_ratio="1:1", resolution="2K")

    assert client.images.with_raw_response.generate.call_args.kwargs["quality"] == "high"


# ---------------------------------------------------------------------------
# APIMart async path
# ---------------------------------------------------------------------------

def _apimart_provider(model="gpt-image-2.5-flare", quality="auto", client=None):
    return _provider(
        model=model,
        quality=quality,
        client=client,
        api_base="https://api.apimart.ai/v1/",
    )


def _completed_task():
    completed = MagicMock()
    completed.json.return_value = {
        "code": 200,
        "data": {
            "status": "completed",
            "result": {"images": [{"url": _png_data_url(Image.new("RGB", (8, 8), color="orange"))}]},
        },
    }
    return completed


def test_apimart_25_uses_async_task_path():
    client = MagicMock()
    client.images.with_raw_response.generate.return_value = _raw_response(
        {"code": 200, "data": [{"status": "submitted", "task_id": "task_25"}]}
    )
    provider = _apimart_provider(client=client)

    with patch("services.ai_providers.image.openai_provider.requests.get", return_value=_completed_task()), patch(
        "services.ai_providers.image.openai_provider.time.sleep"
    ):
        result = provider.generate_image("a cat", aspect_ratio="16:9", resolution="2K")

    assert isinstance(result, Image.Image)
    request = client.images.with_raw_response.generate.call_args.kwargs
    assert request["model"] == "gpt-image-2.5-flare"
    assert request["size"] == "16:9"
    assert request["extra_body"]["resolution"] == "2k"
    assert "quality" not in request


def test_apimart_default_quality_keeps_original_payload():
    client = MagicMock()
    client.images.with_raw_response.generate.return_value = _raw_response(
        {"code": 200, "data": [{"status": "submitted", "task_id": "task_default"}]}
    )
    provider = _apimart_provider(quality="auto", client=client)

    with patch("services.ai_providers.image.openai_provider.requests.get", return_value=_completed_task()), patch(
        "services.ai_providers.image.openai_provider.time.sleep"
    ):
        provider.generate_image("a cat", aspect_ratio="16:9", resolution="2K")

    assert "quality" not in client.images.with_raw_response.generate.call_args.kwargs


def test_apimart_forwards_explicit_extended_quality():
    client = MagicMock()
    client.images.with_raw_response.generate.return_value = _raw_response(
        {"code": 200, "data": [{"status": "submitted", "task_id": "task_max"}]}
    )
    provider = _apimart_provider(quality="max", client=client)

    with patch("services.ai_providers.image.openai_provider.requests.get", return_value=_completed_task()), patch(
        "services.ai_providers.image.openai_provider.time.sleep"
    ):
        provider.generate_image("a cat", aspect_ratio="16:9", resolution="2K")

    assert client.images.with_raw_response.generate.call_args.kwargs["quality"] == "max"


def test_apimart_clamps_extended_quality_for_older_model():
    client = MagicMock()
    client.images.with_raw_response.generate.return_value = _raw_response(
        {"code": 200, "data": [{"status": "submitted", "task_id": "task_clamp"}]}
    )
    provider = _apimart_provider(model="gpt-image-2", quality="max", client=client)

    with patch("services.ai_providers.image.openai_provider.requests.get", return_value=_completed_task()), patch(
        "services.ai_providers.image.openai_provider.time.sleep"
    ):
        provider.generate_image("a cat", aspect_ratio="16:9", resolution="2K")

    assert client.images.with_raw_response.generate.call_args.kwargs["quality"] == "high"


def test_apimart_non_gpt_image_model_never_sends_quality():
    client = MagicMock()
    client.images.with_raw_response.generate.return_value = _raw_response(
        {"data": [{"b64_json": _b64_png()}]}
    )
    provider = _provider(
        model="gemini-3-pro-image-preview",
        quality="max",
        protocol="images",
        client=client,
        api_base="https://api.apimart.ai/v1/",
    )

    provider.generate_image("a cat", aspect_ratio="16:9", resolution="2K")

    # A non-GPT-Image model must not be routed through the APIMart async path
    # (that path forwards `quality`); it keeps the generic images request.
    request = client.images.with_raw_response.generate.call_args.kwargs
    assert "extra_body" not in request
    assert request["quality"] == "auto"


# ---------------------------------------------------------------------------
# Provider factory wiring
# ---------------------------------------------------------------------------

def test_factory_forwards_image_quality_setting(monkeypatch):
    """IMAGE_QUALITY must reach the provider through get_image_provider."""
    monkeypatch.setenv('AI_PROVIDER_FORMAT', 'openai')
    monkeypatch.setenv('OPENAI_API_KEY', 'test-key')
    monkeypatch.setenv('OPENAI_API_BASE', 'https://api.openai.com/v1')
    monkeypatch.setenv('IMAGE_QUALITY', 'xhigh')

    from services.ai_providers import get_image_provider

    with patch("services.ai_providers.image.openai_provider.OpenAI"):
        provider = get_image_provider('gpt-image-2.5-flare')

    assert provider.image_quality == 'xhigh'
    assert provider._resolve_quality() == 'xhigh'


def test_factory_defaults_image_quality_to_auto(monkeypatch):
    monkeypatch.setenv('AI_PROVIDER_FORMAT', 'openai')
    monkeypatch.setenv('OPENAI_API_KEY', 'test-key')
    monkeypatch.setenv('OPENAI_API_BASE', 'https://api.openai.com/v1')
    monkeypatch.delenv('IMAGE_QUALITY', raising=False)

    from services.ai_providers import get_image_provider

    with patch("services.ai_providers.image.openai_provider.OpenAI"):
        provider = get_image_provider('gpt-image-2.5-flare')

    assert provider.image_quality == 'auto'


# ---------------------------------------------------------------------------
# Settings plumbing: startup sync, cache invalidation, explicit auto
# ---------------------------------------------------------------------------

def test_startup_loader_restores_image_quality(monkeypatch):
    """A saved tier must survive a restart (_load_settings_to_config)."""
    import importlib

    from flask import Flask
    from models import Settings

    settings = Settings(image_quality='xhigh')
    monkeypatch.setattr(Settings, 'get_settings', staticmethod(lambda: settings))
    app_module = importlib.reload(importlib.import_module('app'))

    flask_app = Flask(__name__)
    with patch('services.task_manager.sync_resource_limits'):
        app_module._load_settings_to_config(flask_app)

    assert flask_app.config['IMAGE_QUALITY'] == 'xhigh'


def test_startup_loader_falls_back_to_env_quality(monkeypatch):
    import importlib

    from flask import Flask
    from config import Config
    from models import Settings

    monkeypatch.setattr(Config, 'IMAGE_QUALITY', 'medium')
    settings = Settings(image_quality=None)
    monkeypatch.setattr(Settings, 'get_settings', staticmethod(lambda: settings))
    app_module = importlib.reload(importlib.import_module('app'))

    flask_app = Flask(__name__)
    with patch('services.task_manager.sync_resource_limits'):
        app_module._load_settings_to_config(flask_app)

    assert flask_app.config['IMAGE_QUALITY'] == 'medium'


def _new_sync_app(seed=None):
    """Flask app pre-seeded so _sync_settings_to_config rewrites nothing."""
    from flask import Flask
    from config import Config

    app = Flask(__name__)
    app.config.update(
        IMAGE_QUALITY='auto',
        AI_PROVIDER_FORMAT='gemini',
        TEXT_MODEL=Config.TEXT_MODEL,
        IMAGE_MODEL=Config.IMAGE_MODEL,
        IMAGE_CAPTION_MODEL=Config.IMAGE_CAPTION_MODEL,
    )
    if seed:
        app.config.update({k: v for k, v in seed.items() if k != 'IMAGE_QUALITY'})
    return app


def _run_sync_settings(quality, app):
    """Return how often _sync_settings_to_config cleared the AI service cache."""
    from controllers.settings_controller import _sync_settings_to_config
    from models import Settings

    settings = Settings(image_quality=quality, ai_provider_format='gemini')

    with app.app_context(), patch(
        'controllers.settings_controller._provider_api_env_defaults', return_value={}
    ), patch('services.task_manager.sync_resource_limits'), patch(
        'services.ai_service_manager.clear_ai_service_cache'
    ) as clear_cache:
        _sync_settings_to_config(settings)
        return clear_cache.call_count


def test_sync_settings_invalidates_provider_cache_on_quality_change():
    """Image providers are cached per model name, so a quality-only save must
    clear the cache — otherwise generation keeps the previous tier."""
    # Warm the config once so unrelated keys already match, then a repeat run
    # must be a no-op: that makes the quality delta the only variable.
    warm_app = _new_sync_app()
    _run_sync_settings(None, warm_app)

    assert _run_sync_settings(None, _new_sync_app(dict(warm_app.config))) == 0
    assert _run_sync_settings('max', _new_sync_app(dict(warm_app.config))) == 1


def test_update_settings_stores_explicit_auto_quality():
    """Picking 'auto' in the UI must override an IMAGE_QUALITY value from .env,
    so it is stored literally instead of as NULL (= follow env)."""
    from flask import Flask
    from controllers.settings_controller import update_settings
    from models import Settings

    app = Flask(__name__)
    settings = Settings()

    with app.test_request_context('/api/settings/', method='PUT', json={'image_quality': 'auto'}):
        with patch('controllers.settings_controller.Settings.get_settings', return_value=settings), patch(
            'controllers.settings_controller.db.session.commit'
        ), patch('controllers.settings_controller._sync_settings_to_config'):
            response = update_settings()

    assert response[1] == 200 if isinstance(response, tuple) else True
    assert settings.image_quality == 'auto'


def test_codex_quality_mapping(monkeypatch):
    """Codex keeps its historical 'high' default and only passes tiers it can use."""
    from services.ai_providers.image.codex_provider import CodexImageProvider

    assert CodexImageProvider(api_key='t', model='gpt-image-2.5-flare')._resolve_quality() == 'high'
    assert CodexImageProvider(api_key='t', model='gpt-image-2.5-flare', image_quality='max')._resolve_quality() == 'max'
    assert CodexImageProvider(api_key='t', model='gpt-image-2.5-sunburst', image_quality='low')._resolve_quality() == 'low'
    assert CodexImageProvider(api_key='t', model='gpt-image-2', image_quality='max')._resolve_quality() == 'high'
    assert CodexImageProvider(api_key='t', model='gpt-image-2', image_quality='medium')._resolve_quality() == 'medium'
    assert CodexImageProvider(api_key='t', model='gpt-image-2', image_quality='nonsense')._resolve_quality() == 'high'

    payload = CodexImageProvider(api_key='t', model='gpt-image-2.5-flare', image_quality='max')._build_payload(
        'a cat', '16:9'
    )
    assert payload['tools'][0]['quality'] == 'max'
    assert payload['tools'][0]['model'] == 'gpt-image-2.5-flare'
