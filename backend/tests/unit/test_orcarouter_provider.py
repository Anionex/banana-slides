"""
Unit tests for the OrcaRouter provider format.

OrcaRouter is an OpenAI-compatible AI gateway. As a named provider format it
mirrors the ``volcengine`` wiring: its own config keys, its own ``_build_provider_config``
branch, per-model source resolution, and the OpenAI-compatible text/image providers.
"""
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from flask import Flask

from controllers import settings_controller
from controllers.settings_controller import temporary_settings_override, _sync_settings_to_config
from services import ai_providers


def _build_sync_settings(**overrides):
    defaults = {
        'ai_provider_format': 'gemini',
        'api_key': None,
        'api_base_url': None,
        'text_model': None,
        'image_model': None,
        'image_resolution': None,
        'image_aspect_ratio': None,
        'max_description_workers': None,
        'max_image_workers': None,
        'mineru_api_base': None,
        'mineru_token': None,
        'image_caption_model': None,
        'output_language': None,
        'enable_text_reasoning': False,
        'text_thinking_budget': 1024,
        'enable_image_reasoning': False,
        'image_thinking_budget': 1024,
        'baidu_api_key': None,
        'text_model_source': None,
        'image_model_source': None,
        'image_caption_model_source': None,
        'text_api_key': None,
        'text_api_base_url': None,
        'image_api_key': None,
        'image_api_base_url': None,
        'image_caption_api_key': None,
        'image_caption_api_base_url': None,
        'openai_image_api_protocol': None,
        'lazyllm_api_keys': None,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_build_provider_config_orcarouter_defaults(monkeypatch):
    """Global orcarouter config should resolve ORCAROUTER_API_KEY/BASE."""
    app = Flask(__name__)
    app.config.update(
        AI_PROVIDER_FORMAT='orcarouter',
        ORCAROUTER_API_KEY='orca-key',
        ORCAROUTER_API_BASE='https://api.orcarouter.ai/v1',
    )

    with app.app_context():
        cfg = ai_providers._build_provider_config()

    assert cfg['format'] == 'orcarouter'
    assert cfg['api_key'] == 'orca-key'
    assert cfg['api_base'] == 'https://api.orcarouter.ai/v1'


def test_build_provider_config_orcarouter_requires_key(monkeypatch):
    """orcarouter must not silently fall back to a Gemini/OpenAI key."""
    monkeypatch.delenv('ORCAROUTER_API_KEY', raising=False)
    app = Flask(__name__)
    app.config.update(
        AI_PROVIDER_FORMAT='orcarouter',
        GOOGLE_API_KEY='gemini-key',
        OPENAI_API_KEY='openai-key',
        ORCAROUTER_API_KEY='',
        ORCAROUTER_API_BASE='',
    )

    with app.app_context():
        with pytest.raises(ValueError, match='ORCAROUTER_API_KEY'):
            ai_providers._build_provider_config()


def test_get_text_provider_orcarouter_uses_openai_provider():
    """orcarouter should reuse the OpenAI-compatible text provider."""
    app = Flask(__name__)
    app.config.update(
        AI_PROVIDER_FORMAT='orcarouter',
        ORCAROUTER_API_KEY='orca-key',
        ORCAROUTER_API_BASE='https://api.orcarouter.ai/v1',
    )

    with app.app_context():
        with patch('services.ai_providers.OpenAITextProvider') as provider_cls:
            provider = ai_providers.get_text_provider(model='openai/gpt-4o')

    assert provider == provider_cls.return_value
    provider_cls.assert_called_once_with(
        api_key='orca-key',
        api_base='https://api.orcarouter.ai/v1',
        model='openai/gpt-4o',
    )


def test_get_image_provider_orcarouter_uses_openai_provider():
    """orcarouter should reuse the OpenAI-compatible image provider."""
    app = Flask(__name__)
    app.config.update(
        AI_PROVIDER_FORMAT='orcarouter',
        ORCAROUTER_API_KEY='orca-key',
        ORCAROUTER_API_BASE='https://api.orcarouter.ai/v1',
        OPENAI_IMAGE_API_PROTOCOL='auto',
    )

    with app.app_context():
        with patch('services.ai_providers.OpenAIImageProvider') as provider_cls:
            provider = ai_providers.get_image_provider(model='google/gemini-3-pro-image-preview')

    assert provider == provider_cls.return_value
    provider_cls.assert_called_once_with(
        api_key='orca-key',
        api_base='https://api.orcarouter.ai/v1',
        model='google/gemini-3-pro-image-preview',
        image_api_protocol='auto',
    )


def test_per_model_orcarouter_source_uses_orcarouter_key():
    """Per-model orcarouter sources should prefer TEXT_* overrides then ORCAROUTER_API_KEY."""
    app = Flask(__name__)
    app.config.update(
        AI_PROVIDER_FORMAT='gemini',
        ORCAROUTER_API_KEY='orca-global-key',
        ORCAROUTER_API_BASE='https://api.orcarouter.ai/v1',
        TEXT_API_KEY='',
        TEXT_API_BASE='',
        TEXT_MODEL_SOURCE='orcarouter',
    )

    with app.app_context():
        with patch('services.ai_providers.OpenAITextProvider') as provider_cls:
            provider = ai_providers.get_text_provider(model='deepseek/deepseek-chat')

    assert provider == provider_cls.return_value
    provider_cls.assert_called_once_with(
        api_key='orca-global-key',
        api_base='https://api.orcarouter.ai/v1',
        model='deepseek/deepseek-chat',
    )


def test_per_model_orcarouter_source_requires_key(monkeypatch):
    """Per-model orcarouter sources must fail loudly when no OrcaRouter key is set."""
    monkeypatch.delenv('ORCAROUTER_API_KEY', raising=False)
    app = Flask(__name__)
    app.config.update(
        AI_PROVIDER_FORMAT='gemini',
        OPENAI_API_KEY='openai-key',
        ORCAROUTER_API_KEY='',
        ORCAROUTER_API_BASE='',
        TEXT_API_KEY='',
        TEXT_MODEL_SOURCE='orcarouter',
    )

    with app.app_context():
        with pytest.raises(ValueError, match='ORCAROUTER_API_KEY'):
            ai_providers.get_text_provider(model='deepseek/deepseek-chat')


def test_sync_settings_scopes_orcarouter_override(monkeypatch):
    """Global OrcaRouter credentials must not pollute Gemini/OpenAI config."""
    # Patch Config via the module settings_controller references directly:
    # test_app_factory reloads config.py, replacing sys.modules['config'], so a
    # fresh `from config import Config` would bind to a stale module and the
    # monkeypatch would not affect the values _provider_api_env_defaults reads.
    monkeypatch.setattr(settings_controller.Config, 'AI_PROVIDER_FORMAT', 'gemini')
    monkeypatch.setattr(settings_controller.Config, 'GOOGLE_API_BASE', 'https://google-env.example')
    monkeypatch.setattr(settings_controller.Config, 'OPENAI_API_BASE', 'https://openai-env.example/v1')
    monkeypatch.setattr(settings_controller.Config, 'ORCAROUTER_API_BASE', 'https://orca-env.example/v1')
    monkeypatch.setattr(settings_controller.Config, 'GOOGLE_API_KEY', 'google-env-key')
    monkeypatch.setattr(settings_controller.Config, 'OPENAI_API_KEY', 'openai-env-key')
    monkeypatch.setattr(settings_controller.Config, 'ORCAROUTER_API_KEY', 'orca-env-key')

    app = Flask(__name__)
    app.config.update(
        AI_PROVIDER_FORMAT='gemini',
        GOOGLE_API_BASE='polluted-base',
        OPENAI_API_BASE='polluted-base',
        ORCAROUTER_API_BASE='polluted-base',
        GOOGLE_API_KEY='polluted-key',
        OPENAI_API_KEY='polluted-key',
        ORCAROUTER_API_KEY='polluted-key',
    )
    settings = _build_sync_settings(
        ai_provider_format='orcarouter',
        api_base_url='https://orca-db.example/v1',
        api_key='orca-db-key',
        text_model_source='gemini',
    )

    with app.app_context():
        with patch('services.task_manager.sync_resource_limits'):
            with patch('services.ai_service_manager.clear_ai_service_cache'):
                _sync_settings_to_config(settings)

    assert app.config['GOOGLE_API_BASE'] == 'https://google-env.example'
    assert app.config['OPENAI_API_BASE'] == 'https://openai-env.example/v1'
    assert app.config['ORCAROUTER_API_BASE'] == 'https://orca-db.example/v1'
    assert app.config['GOOGLE_API_KEY'] == 'google-env-key'
    assert app.config['OPENAI_API_KEY'] == 'openai-env-key'
    assert app.config['ORCAROUTER_API_KEY'] == 'orca-db-key'
    assert app.config['TEXT_MODEL_SOURCE'] == 'gemini'


def test_temporary_settings_override_scopes_orcarouter_override():
    """Service tests for orcarouter must not route other providers through OrcaRouter."""
    app = Flask(__name__)
    app.config.update(
        AI_PROVIDER_FORMAT='gemini',
        GOOGLE_API_BASE='https://google-env.example',
        OPENAI_API_BASE='https://openai-env.example/v1',
        ORCAROUTER_API_BASE='https://orca-env.example/v1',
        GOOGLE_API_KEY='google-env-key',
        OPENAI_API_KEY='openai-env-key',
        ORCAROUTER_API_KEY='orca-env-key',
    )

    with app.app_context():
        with temporary_settings_override({
            'ai_provider_format': 'orcarouter',
            'api_base_url': 'https://orca-test.example/v1',
            'api_key': 'orca-test-key',
        }):
            assert app.config['GOOGLE_API_BASE'] == 'https://google-env.example'
            assert app.config['OPENAI_API_BASE'] == 'https://openai-env.example/v1'
            assert app.config['ORCAROUTER_API_BASE'] == 'https://orca-test.example/v1'
            assert app.config['GOOGLE_API_KEY'] == 'google-env-key'
            assert app.config['OPENAI_API_KEY'] == 'openai-env-key'
            assert app.config['ORCAROUTER_API_KEY'] == 'orca-test-key'

        assert app.config['ORCAROUTER_API_BASE'] == 'https://orca-env.example/v1'
        assert app.config['ORCAROUTER_API_KEY'] == 'orca-env-key'


def test_settings_to_dict_uses_orcarouter_defaults(monkeypatch):
    """Saved orcarouter selections should display OrcaRouter defaults from Config."""
    from config import Config
    from models.settings import Settings

    monkeypatch.setattr(Config, 'AI_PROVIDER_FORMAT', 'gemini')
    monkeypatch.setattr(Config, 'GOOGLE_API_BASE', 'https://generativelanguage.googleapis.com')
    monkeypatch.setattr(Config, 'GOOGLE_API_KEY', 'gemini-key')
    monkeypatch.setattr(Config, 'ORCAROUTER_API_BASE', 'https://custom-orca.example/v1')
    monkeypatch.setattr(Config, 'ORCAROUTER_API_KEY', 'orca-key')
    monkeypatch.setattr(Config, 'OPENAI_API_KEY', 'openai-key')

    settings = Settings(ai_provider_format='orcarouter')
    data = settings.to_dict()

    assert data['api_base_url'] == 'https://custom-orca.example/v1'
    assert data['api_key_length'] == len('orca-key')
    assert data['text_api_base_url'] is None
    assert data['image_api_base_url'] is None
    assert data['image_caption_api_base_url'] is None


def test_settings_to_dict_orcarouter_defaults_do_not_use_openai_key(monkeypatch):
    """Settings should not present an OpenAI key as an OrcaRouter key."""
    from config import Config
    from models.settings import Settings

    monkeypatch.setattr(Config, 'AI_PROVIDER_FORMAT', 'gemini')
    monkeypatch.setattr(Config, 'GOOGLE_API_BASE', 'https://generativelanguage.googleapis.com')
    monkeypatch.setattr(Config, 'GOOGLE_API_KEY', 'gemini-key')
    monkeypatch.setattr(Config, 'ORCAROUTER_API_BASE', 'https://custom-orca.example/v1')
    monkeypatch.setattr(Config, 'ORCAROUTER_API_KEY', '')
    monkeypatch.setattr(Config, 'OPENAI_API_KEY', 'openai-key')

    settings = Settings(ai_provider_format='orcarouter')
    data = settings.to_dict()

    assert data['api_base_url'] == 'https://custom-orca.example/v1'
    assert data['api_key_length'] == 0
