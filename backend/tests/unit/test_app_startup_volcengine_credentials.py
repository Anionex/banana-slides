"""Startup loader must restore DB-saved Volcengine credentials after restart.

`_sync_settings_to_config()` writes the UI-saved Agent Plans key/base into
`VOLCENGINE_API_KEY` / `VOLCENGINE_API_BASE` at save time, so without the
matching startup sync a backend restart would drop them and Volcengine
providers would fall back to the hard-coded base with no key.
"""

import importlib
from types import SimpleNamespace
from unittest.mock import patch

from models import Settings
from services import ai_providers


def _reload_app_module():
    app_module = importlib.import_module('app')
    return importlib.reload(app_module)


def _fake_settings(**overrides):
    values = {
        'ai_provider_format': 'volcengine',
        'api_base_url': 'https://ark.cn-beijing.volces.com/api/plan/v3',
        'api_key': 'db-saved-volcengine-key',
        'image_resolution': None,
        'image_aspect_ratio': None,
        'max_description_workers': None,
        'max_image_workers': None,
        'text_model': None,
        'image_model': None,
        'mineru_api_base': None,
        'mineru_token': None,
        'image_caption_model': None,
        'output_language': None,
        'enable_text_reasoning': False,
        'text_thinking_budget': 1024,
        'enable_image_reasoning': False,
        'image_thinking_budget': 1024,
        'enable_image_quality_control': False,
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
        'lazyllm_api_keys': None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def _load_settings_into_flask_app(monkeypatch, settings):
    monkeypatch.setattr(Settings, 'get_settings', staticmethod(lambda: settings))
    app_module = _reload_app_module()
    with patch('services.task_manager.sync_resource_limits'):
        from flask import Flask
        flask_app = Flask(__name__)
        app_module._load_settings_to_config(flask_app)
    return flask_app


def test_startup_loader_restores_volcengine_credentials(monkeypatch):
    flask_app = _load_settings_into_flask_app(
        monkeypatch,
        _fake_settings(),
    )

    assert flask_app.config['AI_PROVIDER_FORMAT'] == 'volcengine'
    assert flask_app.config['VOLCENGINE_API_BASE'] == 'https://ark.cn-beijing.volces.com/api/plan/v3'
    assert flask_app.config['VOLCENGINE_API_KEY'] == 'db-saved-volcengine-key'
    # 与保存时一致: 非活动 provider 的配置不得被 DB 值污染
    assert 'OPENAI_API_BASE' not in flask_app.config
    assert 'OPENAI_API_KEY' not in flask_app.config
    assert 'GOOGLE_API_BASE' not in flask_app.config
    assert 'GOOGLE_API_KEY' not in flask_app.config


def test_startup_loader_volcengine_credentials_override_env(monkeypatch):
    """DB-saved credentials must win over .env values, like GOOGLE/OPENAI do."""
    monkeypatch.setenv('VOLCENGINE_API_KEY', 'env-key')
    monkeypatch.setenv('VOLCENGINE_API_BASE', 'https://env.example.com/v1')

    flask_app = _load_settings_into_flask_app(
        monkeypatch,
        _fake_settings(),
    )

    assert flask_app.config['VOLCENGINE_API_BASE'] == 'https://ark.cn-beijing.volces.com/api/plan/v3'
    assert flask_app.config['VOLCENGINE_API_KEY'] == 'db-saved-volcengine-key'


def test_startup_loader_apimart_source_blocks_legacy_per_model_env(monkeypatch):
    """A persisted APIMart source must override old TEXT_* environment values."""
    monkeypatch.setenv('TEXT_MODEL_SOURCE', 'openai')
    monkeypatch.setenv('TEXT_API_KEY', 'legacy-openai-text-key')
    monkeypatch.setenv('TEXT_API_BASE', 'https://legacy-openai.example/v1')
    monkeypatch.setenv('APIMART_API_KEY', 'env-apimart-key')
    monkeypatch.setenv('APIMART_API_BASE', 'https://api.apimart.ai/v1')

    flask_app = _load_settings_into_flask_app(
        monkeypatch,
        _fake_settings(
            ai_provider_format='apimart',
            api_base_url='https://api.apimart.ai/v1',
            api_key='db-apimart-key',
            text_model_source='apimart',
            text_api_key='',
            text_api_base_url='',
        ),
    )

    with flask_app.app_context():
        config = ai_providers._get_model_type_provider_config('text')

    assert flask_app.config['TEXT_MODEL_SOURCE_FROM_SETTINGS'] is True
    assert flask_app.config['TEXT_API_KEY_FROM_SETTINGS'] is True
    assert flask_app.config['TEXT_API_BASE_FROM_SETTINGS'] is True
    assert config == {
        'format': 'apimart',
        'api_key': 'db-apimart-key',
        'api_base': 'https://api.apimart.ai/v1',
    }


def test_startup_loader_saved_source_preserves_per_model_env_credentials(monkeypatch):
    """A saved source may intentionally use documented TEXT_* environment values."""
    monkeypatch.setenv('TEXT_MODEL_SOURCE', 'openai')
    monkeypatch.setenv('TEXT_API_KEY', 'intentional-apimart-text-key')
    monkeypatch.setenv('TEXT_API_BASE', 'https://text.apimart.example/v1')
    monkeypatch.setenv('APIMART_API_KEY', 'global-apimart-key')
    monkeypatch.setenv('APIMART_API_BASE', 'https://api.apimart.ai/v1')

    flask_app = _load_settings_into_flask_app(
        monkeypatch,
        _fake_settings(
            ai_provider_format='apimart',
            api_base_url='https://api.apimart.ai/v1',
            api_key='db-apimart-key',
            text_model_source='apimart',
        ),
    )

    with flask_app.app_context():
        config = ai_providers._get_model_type_provider_config('text')

    assert flask_app.config['TEXT_MODEL_SOURCE_FROM_SETTINGS'] is True
    assert flask_app.config['TEXT_API_KEY_FROM_SETTINGS'] is False
    assert flask_app.config['TEXT_API_BASE_FROM_SETTINGS'] is False
    assert config == {
        'format': 'apimart',
        'api_key': 'intentional-apimart-text-key',
        'api_base': 'https://text.apimart.example/v1',
    }


def test_startup_loader_does_not_pollute_volcengine_keys_for_other_formats(monkeypatch):
    """Non-Volcengine global settings must not overwrite env/ARK Volcengine config."""
    monkeypatch.setenv('VOLCENGINE_API_KEY', 'env-volcengine-key')
    monkeypatch.setenv('VOLCENGINE_API_BASE', 'https://env-volcengine.example.com/v1')

    flask_app = _load_settings_into_flask_app(
        monkeypatch,
        _fake_settings(
            ai_provider_format='gemini',
            api_base_url='https://generativelanguage.googleapis.com',
            api_key='db-saved-gemini-key',
        ),
    )

    # 全局 provider 是 gemini 时, 启动同步不得把 gemini 的 base/key 写进 VOLCENGINE_*,
    # 否则 per-model volcengine 调用会命中 Google 端点并使用错误的 key
    assert 'VOLCENGINE_API_BASE' not in flask_app.config
    assert 'VOLCENGINE_API_KEY' not in flask_app.config
    # gemini 是活动 provider, 应正常同步
    assert flask_app.config['GOOGLE_API_BASE'] == 'https://generativelanguage.googleapis.com'
    assert flask_app.config['GOOGLE_API_KEY'] == 'db-saved-gemini-key'


def test_startup_loader_does_not_pollute_openai_keys_for_volcengine_format(monkeypatch):
    """Volcengine 全局设置不得污染 per-model openai/gemini 的 app.config 值."""
    flask_app = _load_settings_into_flask_app(
        monkeypatch,
        _fake_settings(
            ai_provider_format='volcengine',
            api_base_url='https://ark.cn-beijing.volces.com/api/plan/v3',
            api_key='db-saved-volcengine-key',
        ),
    )

    assert flask_app.config['VOLCENGINE_API_BASE'] == 'https://ark.cn-beijing.volces.com/api/plan/v3'
    assert flask_app.config['VOLCENGINE_API_KEY'] == 'db-saved-volcengine-key'
    assert 'OPENAI_API_BASE' not in flask_app.config
    assert 'OPENAI_API_KEY' not in flask_app.config
    assert 'GOOGLE_API_BASE' not in flask_app.config
    assert 'GOOGLE_API_KEY' not in flask_app.config
