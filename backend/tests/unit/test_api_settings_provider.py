"""
Settings controller tests for provider format handling.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import requests
from flask import Flask

from controllers import settings_controller
from controllers.settings_controller import temporary_settings_override, update_settings, verify_api_key
from controllers.settings_controller import _sync_settings_to_config
from services import ai_providers


def _build_settings(**overrides):
    defaults = {
        'ai_provider_format': 'gemini',
        'api_key': None,
        'api_base_url': None,
        'text_model': None,
        'text_model_source': None,
        'image_model_source': None,
        'image_caption_model_source': None,
        'text_api_key': None,
        'text_api_base_url': None,
        'image_api_key': None,
        'image_api_base_url': None,
        'image_caption_api_key': None,
        'image_caption_api_base_url': None,
    }
    defaults.update(overrides)

    settings = SimpleNamespace(**defaults)
    settings.to_dict = lambda: {
        'ai_provider_format': settings.ai_provider_format,
        'api_key_length': len(settings.api_key) if settings.api_key else 0,
    }
    return settings


def test_get_test_image_path_prefers_pyinstaller_meipass(tmp_path, monkeypatch):
    """Packaged desktop builds should resolve bundled assets from sys._MEIPASS."""
    project_root = tmp_path / 'project'
    meipass_root = tmp_path / 'bundle'
    bundled_asset = meipass_root / 'assets' / 'test_img.png'
    bundled_asset.parent.mkdir(parents=True)
    bundled_asset.write_bytes(b'png')

    monkeypatch.setattr(settings_controller, 'PROJECT_ROOT', str(project_root))
    monkeypatch.setattr(settings_controller.sys, 'frozen', True, raising=False)
    monkeypatch.setattr(settings_controller.sys, '_MEIPASS', str(meipass_root), raising=False)

    assert settings_controller._get_test_image_path() == bundled_asset


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


def test_update_settings_accepts_lazyllm_provider():
    """`lazyllm` should be accepted as a valid provider format."""
    app = Flask(__name__)

    settings = _build_settings()
    with app.app_context():
        with app.test_request_context('/api/settings/', method='PUT', json={'ai_provider_format': 'lazyllm'}):
            with patch('controllers.settings_controller.Settings.get_settings', return_value=settings):
                with patch('controllers.settings_controller.db.session.commit'):
                    with patch('controllers.settings_controller._sync_settings_to_config'):
                        response, status_code = update_settings()

    assert status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['data']['ai_provider_format'] == 'lazyllm'


def test_update_settings_accepts_volcengine_provider():
    """`volcengine` should be accepted as a valid provider format."""
    app = Flask(__name__)

    settings = _build_settings()
    with app.app_context():
        with app.test_request_context('/api/settings/', method='PUT', json={'ai_provider_format': 'volcengine'}):
            with patch('controllers.settings_controller.Settings.get_settings', return_value=settings):
                with patch('controllers.settings_controller.db.session.commit'):
                    with patch('controllers.settings_controller._sync_settings_to_config'):
                        response, status_code = update_settings()

    assert status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['data']['ai_provider_format'] == 'volcengine'


def test_update_settings_accepts_apimart_provider():
    """`apimart` should persist as a first-class provider format."""
    app = Flask(__name__)

    settings = _build_settings()
    with app.app_context():
        with app.test_request_context('/api/settings/', method='PUT', json={'ai_provider_format': 'apimart'}):
            with patch('controllers.settings_controller.Settings.get_settings', return_value=settings):
                with patch('controllers.settings_controller.db.session.commit'):
                    with patch('controllers.settings_controller._sync_settings_to_config'):
                        response, status_code = update_settings()

    assert status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['data']['ai_provider_format'] == 'apimart'


def test_update_settings_clears_shared_api_key_with_null():
    """Provider switches can explicitly clear the shared stored credential."""
    app = Flask(__name__)

    settings = _build_settings()
    settings.api_key = 'old-provider-key'
    with app.app_context():
        with app.test_request_context('/api/settings/', method='PUT', json={'api_key': None}):
            with patch('controllers.settings_controller.Settings.get_settings', return_value=settings):
                with patch('controllers.settings_controller.db.session.commit'):
                    with patch('controllers.settings_controller._sync_settings_to_config'):
                        response, status_code = update_settings()

    assert status_code == 200
    assert response.get_json()['success'] is True
    assert settings.api_key is None


def test_update_settings_preserves_key_for_explicit_apimart_model_sources():
    """APIMart model overrides retain the old global key after a global switch."""
    app = Flask(__name__)

    settings = _build_settings(
        ai_provider_format='apimart',
        api_key='apimart-key',
        api_base_url='https://apimart-proxy.example/v1',
        text_model_source='apimart',
        image_model_source='apimart',
        image_caption_model_source='apimart',
        image_api_key='dedicated-image-key',
        image_api_base_url='https://dedicated-image.example/v1',
    )
    payload = {'ai_provider_format': 'gemini', 'api_key': None}
    with app.app_context():
        with app.test_request_context('/api/settings/', method='PUT', json=payload):
            with patch('controllers.settings_controller.Settings.get_settings', return_value=settings):
                with patch('controllers.settings_controller.db.session.commit'):
                    with patch('controllers.settings_controller._sync_settings_to_config'):
                        response, status_code = update_settings()

    assert status_code == 200
    assert response.get_json()['success'] is True
    assert settings.api_key is None
    assert settings.text_api_key == 'apimart-key'
    assert settings.text_api_base_url == 'https://apimart-proxy.example/v1'
    assert settings.image_api_key == 'dedicated-image-key'
    assert settings.image_api_base_url == 'https://dedicated-image.example/v1'
    assert settings.image_caption_api_key == 'apimart-key'
    assert settings.image_caption_api_base_url == 'https://apimart-proxy.example/v1'


def test_update_settings_preserves_previous_key_when_entering_apimart():
    """Retained explicit model sources keep the previous provider's global key."""
    app = Flask(__name__)

    settings = _build_settings(
        ai_provider_format='gemini',
        api_key='gemini-key',
        api_base_url='https://gemini-proxy.example/v1beta',
        text_model_source='gemini',
        image_model_source='openai',
        image_caption_model_source='gemini',
    )
    payload = {'ai_provider_format': 'apimart', 'api_key': 'new-apimart-key'}
    with app.app_context():
        with app.test_request_context('/api/settings/', method='PUT', json=payload):
            with patch('controllers.settings_controller.Settings.get_settings', return_value=settings):
                with patch('controllers.settings_controller.db.session.commit'):
                    with patch('controllers.settings_controller._sync_settings_to_config'):
                        response, status_code = update_settings()

    assert status_code == 200
    assert response.get_json()['success'] is True
    assert settings.api_key == 'new-apimart-key'
    assert settings.text_api_key == 'gemini-key'
    assert settings.text_api_base_url == 'https://gemini-proxy.example/v1beta'
    assert settings.image_api_key is None
    assert settings.image_api_base_url is None
    assert settings.image_caption_api_key == 'gemini-key'
    assert settings.image_caption_api_base_url == 'https://gemini-proxy.example/v1beta'


def test_update_settings_honors_explicit_per_model_base_clear():
    """Clearing a dedicated model Base URL must not restore the old global URL."""
    app = Flask(__name__)

    settings = _build_settings(
        ai_provider_format='gemini',
        api_key='gemini-key',
        api_base_url='https://gemini-proxy.example/v1beta',
        text_model_source='gemini',
    )
    payload = {
        'ai_provider_format': 'apimart',
        'api_key': 'new-apimart-key',
        'text_api_base_url': '',
    }
    with app.app_context():
        with app.test_request_context('/api/settings/', method='PUT', json=payload):
            with patch('controllers.settings_controller.Settings.get_settings', return_value=settings):
                with patch('controllers.settings_controller.db.session.commit'):
                    with patch('controllers.settings_controller._sync_settings_to_config'):
                        response, status_code = update_settings()

    assert status_code == 200
    assert response.get_json()['success'] is True
    assert settings.text_api_key == 'gemini-key'
    assert settings.text_api_base_url is None


def test_volcengine_text_provider_uses_modelark_openai_compatible_base():
    """Volcengine AgentPlans should reuse the OpenAI-compatible text provider."""
    app = Flask(__name__)
    app.config.update(
        AI_PROVIDER_FORMAT='volcengine',
        VOLCENGINE_API_KEY='volcengine-key',
        VOLCENGINE_API_BASE='https://ark.cn-beijing.volces.com/api/v3',
    )

    with app.app_context():
        with patch('services.ai_providers.OpenAITextProvider') as provider_cls:
            provider = ai_providers.get_text_provider(model='doubao-seed-2-0')

    assert provider == provider_cls.return_value
    provider_cls.assert_called_once_with(
        api_key='volcengine-key',
        api_base='https://ark.cn-beijing.volces.com/api/v3',
        model='doubao-seed-2-0',
    )


def test_volcengine_empty_base_string_falls_back_to_default():
    """A blank VOLCENGINE_API_BASE (e.g. .env left empty) must not reach the
    provider as an empty base URL, which previously surfaced as an
    APIConnectionError 'Connection error.' from httpx UnsupportedProtocol.
    The fallback is the Agent Plans endpoint, matching the UI prefill."""
    app = Flask(__name__)
    app.config.update(
        AI_PROVIDER_FORMAT='volcengine',
        VOLCENGINE_API_KEY='volcengine-key',
        VOLCENGINE_API_BASE='',
    )

    with app.app_context():
        with patch('services.ai_providers.OpenAITextProvider') as provider_cls:
            provider = ai_providers.get_text_provider(model='doubao-seed-2.1-turbo')

    assert provider == provider_cls.return_value
    provider_cls.assert_called_once_with(
        api_key='volcengine-key',
        api_base='https://ark.cn-beijing.volces.com/api/plan/v3',
        model='doubao-seed-2.1-turbo',
    )


def test_resolve_setting_treats_empty_string_as_unset(monkeypatch):
    """Empty strings must fall through _resolve_setting instead of being
    returned verbatim (blank .env values currently poison every provider)."""
    monkeypatch.delenv('VOLCENGINE_API_BASE', raising=False)
    monkeypatch.delenv('VOLCENGINE_API_KEY', raising=False)
    app = Flask(__name__)
    app.config.update(
        VOLCENGINE_API_BASE='',
        VOLCENGINE_API_KEY='',
    )

    with app.app_context():
        assert ai_providers._resolve_setting('VOLCENGINE_API_BASE', 'fallback-base') == 'fallback-base'
        assert ai_providers._resolve_setting('VOLCENGINE_API_KEY', 'fallback-key') == 'fallback-key'

    # Environment level: empty env var must also fall through to the fallback.
    monkeypatch.setenv('VOLCENGINE_API_BASE', '')
    assert ai_providers._resolve_setting('VOLCENGINE_API_BASE', 'fallback-base') == 'fallback-base'


def test_doubao_seedream_auto_protocol_uses_native_images_api():
    """Seedream models must route to images.generate under the auto protocol
    (the Agent Plan chat endpoint has no image modality) and must not send a
    quality param the Volcengine endpoint rejects."""
    from services.ai_providers.image.openai_provider import OpenAIImageProvider

    mock_client = MagicMock()
    mock_result = MagicMock()
    mock_result.data = [MagicMock(b64_json=None, url='https://example.com/img.png')]
    mock_client.images.generate.return_value = mock_result

    with patch('services.ai_providers.image.openai_provider.OpenAI'):
        provider = OpenAIImageProvider(
            api_key='volcengine-key',
            api_base='https://ark.cn-beijing.volces.com/api/plan/v3',
            model='doubao-seedream-5.0-lite',
            image_api_protocol='auto',
        )
    # Inject the mock client directly (mirrors test_openai_image_multi_reference)
    # so the test is robust to module import-path differences in CI.
    provider.client = mock_client
    with patch('requests.get') as mock_get:
        import base64 as _b64
        png_bytes = _b64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        )
        mock_get.return_value.__enter__.return_value.content = png_bytes
        provider.generate_image(
            prompt='a cat',
            aspect_ratio='16:9',
            resolution='2K',
        )

    mock_client.images.generate.assert_called_once()
    kwargs = mock_client.images.generate.call_args.kwargs
    assert kwargs['model'] == 'doubao-seedream-5.0-lite'
    assert 'quality' not in kwargs
    mock_client.chat.completions.create.assert_not_called()


def test_doubao_seedream_forced_images_protocol_keeps_references_on_chat_path():
    """Seedream + reference images must never call images.edit, even when the
    images protocol is forced ('images'): images.edit is SeedEdit-only and the
    Agent Plans recommended models save openai_image_api_protocol=images."""
    from io import BytesIO

    from PIL import Image
    from services.ai_providers.image.openai_provider import OpenAIImageProvider

    mock_client = MagicMock()
    buf = BytesIO()
    Image.new('RGB', (8, 8), color='red').save(buf, format='PNG')
    import base64 as _b64
    png_data = _b64.b64encode(buf.getvalue()).decode()
    chat_message = MagicMock()
    chat_message.images = None
    chat_message.multi_mod_content = None
    chat_message.content = [
        {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{png_data}'}}
    ]
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=chat_message)]
    mock_client.chat.completions.create.return_value = mock_response

    with patch('services.ai_providers.image.openai_provider.OpenAI'):
        provider = OpenAIImageProvider(
            api_key='volcengine-key',
            api_base='https://ark.cn-beijing.volces.com/api/plan/v3',
            model='doubao-seedream-5.0-lite',
            image_api_protocol='images',
        )
    provider.client = mock_client

    result = provider.generate_image(
        prompt='a cat',
        ref_images=[Image.new('RGB', (8, 8), color='blue')],
        aspect_ratio='16:9',
        resolution='2K',
    )

    assert isinstance(result, Image.Image)
    mock_client.chat.completions.create.assert_called_once()
    mock_client.images.edit.assert_not_called()
    mock_client.images.generate.assert_not_called()


def test_doubao_seedream_forced_images_protocol_without_references_uses_images_api():
    """Seedream without reference images must still use images.generate when the
    images protocol is forced."""
    from services.ai_providers.image.openai_provider import OpenAIImageProvider

    mock_client = MagicMock()
    mock_result = MagicMock()
    mock_result.data = [MagicMock(b64_json=None, url='https://example.com/img.png')]
    mock_client.images.generate.return_value = mock_result

    with patch('services.ai_providers.image.openai_provider.OpenAI'):
        provider = OpenAIImageProvider(
            api_key='volcengine-key',
            api_base='https://ark.cn-beijing.volces.com/api/plan/v3',
            model='doubao-seedream-5.0-lite',
            image_api_protocol='images',
        )
    provider.client = mock_client
    with patch('requests.get') as mock_get:
        import base64 as _b64
        png_bytes = _b64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        )
        mock_get.return_value.__enter__.return_value.content = png_bytes
        provider.generate_image(
            prompt='a cat',
            aspect_ratio='16:9',
            resolution='2K',
        )

    mock_client.images.generate.assert_called_once()
    mock_client.chat.completions.create.assert_not_called()


def test_volcengine_provider_does_not_fallback_to_gemini_key():
    """Volcengine should not send a Gemini key to an OpenAI-compatible endpoint."""
    app = Flask(__name__)
    app.config.update(
        AI_PROVIDER_FORMAT='volcengine',
        GOOGLE_API_KEY='gemini-key',
        OPENAI_API_KEY='',
        VOLCENGINE_API_KEY='',
        ARK_API_KEY='',
        VOLCENGINE_API_BASE='https://ark.cn-beijing.volces.com/api/v3',
    )

    with app.app_context():
        with pytest.raises(ValueError, match='AI_PROVIDER_FORMAT=volcengine'):
            ai_providers.get_text_provider(model='doubao-seed-2-0')


def test_volcengine_provider_does_not_fallback_to_openai_key():
    """Volcengine should not send an OpenAI key to the Volcengine endpoint."""
    app = Flask(__name__)
    app.config.update(
        AI_PROVIDER_FORMAT='volcengine',
        GOOGLE_API_KEY='',
        OPENAI_API_KEY='openai-key',
        VOLCENGINE_API_KEY='',
        ARK_API_KEY='',
        VOLCENGINE_API_BASE='https://ark.cn-beijing.volces.com/api/v3',
    )

    with app.app_context():
        with pytest.raises(ValueError, match='AI_PROVIDER_FORMAT=volcengine'):
            ai_providers.get_text_provider(model='doubao-seed-2-0')


def test_per_model_volcengine_source_does_not_fallback_to_openai_key():
    """Per-model Volcengine sources should require Volcengine/Ark credentials."""
    app = Flask(__name__)
    app.config.update(
        AI_PROVIDER_FORMAT='gemini',
        OPENAI_API_KEY='openai-key',
        VOLCENGINE_API_KEY='',
        ARK_API_KEY='',
        TEXT_API_KEY='',
        TEXT_MODEL_SOURCE='volcengine',
    )

    with app.app_context():
        with pytest.raises(ValueError, match='Volcengine AgentPlans'):
            ai_providers.get_text_provider(model='doubao-seed-2-0')


def test_settings_to_dict_uses_volcengine_defaults_for_selected_provider(monkeypatch):
    """Saved Volcengine selections should display ModelArk defaults from Config."""
    from config import Config
    from models.settings import Settings

    monkeypatch.setattr(Config, 'AI_PROVIDER_FORMAT', 'gemini')
    monkeypatch.setattr(Config, 'GOOGLE_API_BASE', 'https://generativelanguage.googleapis.com')
    monkeypatch.setattr(Config, 'GOOGLE_API_KEY', 'gemini-key')
    monkeypatch.setattr(Config, 'VOLCENGINE_API_BASE', 'https://custom-volc.example/api/v3')
    monkeypatch.setattr(Config, 'VOLCENGINE_API_KEY', 'volcengine-key')
    monkeypatch.setattr(Config, 'OPENAI_API_KEY', 'openai-key')

    settings = Settings(ai_provider_format='volcengine')
    data = settings.to_dict()

    assert data['api_base_url'] == 'https://custom-volc.example/api/v3'
    assert data['api_key_length'] == len('volcengine-key')
    assert data['text_api_base_url'] is None
    assert data['image_api_base_url'] is None
    assert data['image_caption_api_base_url'] is None


def test_settings_to_dict_uses_effective_apimart_global_credentials_for_matching_source(monkeypatch):
    """Matching APIMart model sources should display the saved global proxy."""
    from config import Config
    from models.settings import Settings

    monkeypatch.setattr(Config, 'APIMART_API_BASE', 'https://api.apimart.ai/v1')
    monkeypatch.setattr(Config, 'APIMART_API_KEY', 'env-apimart-key')
    monkeypatch.setattr(Config, 'TEXT_API_BASE', '')
    monkeypatch.setattr(Config, 'TEXT_API_KEY', '')

    settings = Settings(
        ai_provider_format='apimart',
        api_base_url='https://apimart-proxy.example/v1',
        api_key='saved-apimart-key',
        text_model_source='apimart',
    )
    data = settings.to_dict()

    assert data['api_base_url'] == 'https://apimart-proxy.example/v1'
    assert data['text_api_base_url'] == 'https://apimart-proxy.example/v1'
    assert data['text_api_key_length'] == len('saved-apimart-key')


def test_settings_to_dict_volcengine_defaults_do_not_use_openai_key(monkeypatch):
    """Settings should not present an OpenAI key as a Volcengine key."""
    from config import Config
    from models.settings import Settings

    monkeypatch.setattr(Config, 'AI_PROVIDER_FORMAT', 'gemini')
    monkeypatch.setattr(Config, 'GOOGLE_API_BASE', 'https://generativelanguage.googleapis.com')
    monkeypatch.setattr(Config, 'GOOGLE_API_KEY', 'gemini-key')
    monkeypatch.setattr(Config, 'VOLCENGINE_API_BASE', 'https://custom-volc.example/api/v3')
    monkeypatch.setattr(Config, 'VOLCENGINE_API_KEY', '')
    monkeypatch.setattr(Config, 'OPENAI_API_KEY', 'openai-key')

    settings = Settings(ai_provider_format='volcengine')
    data = settings.to_dict()

    assert data['api_base_url'] == 'https://custom-volc.example/api/v3'
    assert data['api_key_length'] == 0


def test_settings_to_dict_uses_volcengine_defaults_for_per_model_source(monkeypatch):
    """Per-model Volcengine selections should display ModelArk defaults for that row only."""
    from config import Config
    from models.settings import Settings

    monkeypatch.setattr(Config, 'AI_PROVIDER_FORMAT', 'gemini')
    monkeypatch.setattr(Config, 'GOOGLE_API_BASE', 'https://generativelanguage.googleapis.com')
    monkeypatch.setattr(Config, 'GOOGLE_API_KEY', 'gemini-key')
    monkeypatch.setattr(Config, 'VOLCENGINE_API_BASE', 'https://custom-volc.example/api/v3')
    monkeypatch.setattr(Config, 'VOLCENGINE_API_KEY', 'volcengine-key')
    monkeypatch.setattr(Config, 'OPENAI_API_KEY', 'openai-key')

    settings = Settings(ai_provider_format='gemini', text_model_source='volcengine')
    data = settings.to_dict()

    assert data['api_base_url'] == 'https://generativelanguage.googleapis.com'
    assert data['text_api_base_url'] == 'https://custom-volc.example/api/v3'
    assert data['text_api_key_length'] == len('volcengine-key')
    assert data['image_api_base_url'] is None
    assert data['image_caption_api_base_url'] is None


def test_settings_to_dict_uses_specific_per_model_api_defaults(monkeypatch):
    """Per-model provider rows should prefer TEXT/IMAGE-specific env credentials."""
    from config import Config
    from models.settings import Settings

    monkeypatch.setattr(Config, 'AI_PROVIDER_FORMAT', 'gemini')
    monkeypatch.setattr(Config, 'GOOGLE_API_BASE', 'https://generativelanguage.googleapis.com')
    monkeypatch.setattr(Config, 'GOOGLE_API_KEY', 'gemini-key')
    monkeypatch.setattr(Config, 'VOLCENGINE_API_BASE', 'https://global-volc.example/api/v3')
    monkeypatch.setattr(Config, 'VOLCENGINE_API_KEY', 'global-volc-key')
    monkeypatch.setattr(Config, 'TEXT_API_BASE', 'https://text-volc.example/api/v3')
    monkeypatch.setattr(Config, 'TEXT_API_KEY', 'text-volc-key')

    settings = Settings(ai_provider_format='gemini', text_model_source='volcengine')
    data = settings.to_dict()

    assert data['text_api_base_url'] == 'https://text-volc.example/api/v3'
    assert data['text_api_key_length'] == len('text-volc-key')
    assert data['api_base_url'] == 'https://generativelanguage.googleapis.com'


def test_sync_settings_scopes_global_api_override_to_active_provider(monkeypatch):
    """Global Volcengine credentials must not pollute Gemini/OpenAI config used by per-model sources."""
    from config import Config

    monkeypatch.setattr(Config, 'AI_PROVIDER_FORMAT', 'gemini')
    monkeypatch.setattr(Config, 'GOOGLE_API_BASE', 'https://google-env.example')
    monkeypatch.setattr(Config, 'OPENAI_API_BASE', 'https://openai-env.example/v1')
    monkeypatch.setattr(Config, 'VOLCENGINE_API_BASE', 'https://volc-env.example/api/v3')
    monkeypatch.setattr(Config, 'GOOGLE_API_KEY', 'google-env-key')
    monkeypatch.setattr(Config, 'OPENAI_API_KEY', 'openai-env-key')
    monkeypatch.setattr(Config, 'VOLCENGINE_API_KEY', 'volc-env-key')

    app = Flask(__name__)
    app.config.update(
        AI_PROVIDER_FORMAT='gemini',
        GOOGLE_API_BASE='polluted-base',
        OPENAI_API_BASE='polluted-base',
        VOLCENGINE_API_BASE='polluted-base',
        GOOGLE_API_KEY='polluted-key',
        OPENAI_API_KEY='polluted-key',
        VOLCENGINE_API_KEY='polluted-key',
    )
    settings = _build_sync_settings(
        ai_provider_format='volcengine',
        api_base_url='https://volc-db.example/api/v3',
        api_key='volc-db-key',
        text_model_source='gemini',
    )

    with app.app_context():
        with patch('services.task_manager.sync_resource_limits'):
            with patch('services.ai_service_manager.clear_ai_service_cache'):
                _sync_settings_to_config(settings)

    assert app.config['GOOGLE_API_BASE'] == 'https://google-env.example'
    assert app.config['OPENAI_API_BASE'] == 'https://openai-env.example/v1'
    assert app.config['VOLCENGINE_API_BASE'] == 'https://volc-db.example/api/v3'
    assert app.config['GOOGLE_API_KEY'] == 'google-env-key'
    assert app.config['OPENAI_API_KEY'] == 'openai-env-key'
    assert app.config['VOLCENGINE_API_KEY'] == 'volc-db-key'
    assert app.config['TEXT_MODEL_SOURCE'] == 'gemini'


def test_temporary_settings_override_scopes_global_api_override_to_active_provider():
    """Settings service tests should not temporarily route other providers through Volcengine."""
    app = Flask(__name__)
    app.config.update(
        AI_PROVIDER_FORMAT='gemini',
        GOOGLE_API_BASE='https://google-env.example',
        OPENAI_API_BASE='https://openai-env.example/v1',
        VOLCENGINE_API_BASE='https://volc-env.example/api/v3',
        GOOGLE_API_KEY='google-env-key',
        OPENAI_API_KEY='openai-env-key',
        VOLCENGINE_API_KEY='volc-env-key',
    )

    with app.app_context():
        with temporary_settings_override({
            'ai_provider_format': 'volcengine',
            'api_base_url': 'https://volc-test.example/api/v3',
            'api_key': 'volc-test-key',
        }):
            assert app.config['GOOGLE_API_BASE'] == 'https://google-env.example'
            assert app.config['OPENAI_API_BASE'] == 'https://openai-env.example/v1'
            assert app.config['VOLCENGINE_API_BASE'] == 'https://volc-test.example/api/v3'
            assert app.config['GOOGLE_API_KEY'] == 'google-env-key'
            assert app.config['OPENAI_API_KEY'] == 'openai-env-key'
            assert app.config['VOLCENGINE_API_KEY'] == 'volc-test-key'

        assert app.config['VOLCENGINE_API_BASE'] == 'https://volc-env.example/api/v3'
        assert app.config['VOLCENGINE_API_KEY'] == 'volc-env-key'


def test_temporary_settings_override_applies_explicit_credential_clears():
    """Unsaved provider switches must not reuse saved global or per-model credentials."""
    app = Flask(__name__)
    app.config.update(
        AI_PROVIDER_FORMAT='gemini',
        APIMART_API_BASE='https://saved-apimart.example/v1',
        APIMART_API_KEY='saved-apimart-key',
        TEXT_API_BASE='https://saved-text.example/v1',
        TEXT_API_KEY='saved-text-key',
    )

    with app.app_context():
        with temporary_settings_override({
            'ai_provider_format': 'apimart',
            'api_base_url': '',
            'api_key': None,
            'text_api_base_url': '',
            'text_api_key': None,
        }):
            assert 'APIMART_API_BASE' not in app.config
            assert 'APIMART_API_KEY' not in app.config
            assert 'TEXT_API_BASE' not in app.config
            assert 'TEXT_API_KEY' not in app.config

        assert app.config['APIMART_API_BASE'] == 'https://saved-apimart.example/v1'
        assert app.config['APIMART_API_KEY'] == 'saved-apimart-key'
        assert app.config['TEXT_API_BASE'] == 'https://saved-text.example/v1'
        assert app.config['TEXT_API_KEY'] == 'saved-text-key'


def test_verify_uses_configured_text_model():
    """Verify endpoint should use configured text model, not a hardcoded gemini model."""
    app = Flask(__name__)
    app.config.update(
        TEXT_MODEL='gemini-3-flash-preview',
        AI_PROVIDER_FORMAT='lazyllm',
    )

    settings = _build_settings(ai_provider_format='lazyllm', text_model='deepseek-chat')
    mock_provider = MagicMock()
    mock_provider.generate_text.return_value = 'OK'

    with app.app_context():
        with app.test_request_context('/api/settings/verify', method='POST'):
            with patch('controllers.settings_controller.Settings.get_settings', return_value=settings):
                with patch('services.ai_providers.get_text_provider', return_value=mock_provider) as mock_get_provider:
                    response, status_code = verify_api_key()

    assert status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['data']['available'] is True
    mock_get_provider.assert_called_once_with(model='deepseek-chat')
    mock_provider.generate_text.assert_called_once()


def test_codex_401_settings_test_disconnects_oauth_and_reports_state(client, app):
    """A Codex 401 during settings tests should clear stale OAuth state."""
    with app.app_context():
        from models import Settings, Task, db

        settings = Settings.get_settings()
        settings.openai_oauth_access_token = 'expired-access-token'
        settings.openai_oauth_refresh_token = 'expired-refresh-token'
        settings.openai_oauth_account_id = 'user@example.com'
        task = Task(
            project_id='settings-test',
            task_type='TEST_TEXT_MODEL',
            status='PENDING',
        )
        db.session.add(task)
        db.session.commit()
        task_id = task.id

        response = requests.Response()
        response.status_code = 401
        response.url = 'https://chatgpt.com/backend-api/codex/responses'
        error = requests.exceptions.HTTPError(
            '401 Client Error: Unauthorized for url: https://chatgpt.com/backend-api/codex/responses',
            response=response,
        )

        def fail_with_codex_401():
            raise error

        with patch.dict(settings_controller.TEST_FUNCTIONS, {'text-model': fail_with_codex_401}):
            settings_controller._run_test_async(
                task_id,
                'text-model',
                {'text_model_source': 'codex'},
                app,
            )

        db.session.expire_all()
        settings = Settings.get_settings()
        assert settings.openai_oauth_access_token is None
        assert settings.openai_oauth_refresh_token is None
        assert settings.openai_oauth_account_id is None

    status_response = client.get(f'/api/settings/tests/{task_id}/status')
    assert status_response.status_code == 200
    data = status_response.get_json()
    assert data['success'] is True
    assert data['data']['status'] == 'FAILED'
    assert data['data']['openai_oauth_disconnected'] is True
    assert '重新登录 OpenAI' in data['data']['error']


@pytest.mark.parametrize(
    ('test_name', 'source_key', 'task_type'),
    [
        ('text-model', 'text_model_source', 'TEST_TEXT_MODEL'),
        ('image-model', 'image_model_source', 'TEST_IMAGE_MODEL'),
        ('caption-model', 'image_caption_model_source', 'TEST_CAPTION_MODEL'),
    ],
)
def test_codex_oauth_not_connected_settings_test_disconnects_oauth_and_reports_state(
    client,
    app,
    test_name,
    source_key,
    task_type,
):
    """A Codex settings test should sync OAuth state when no token can be loaded."""
    with app.app_context():
        from models import Settings, Task, db

        settings = Settings.get_settings()
        settings.openai_oauth_access_token = 'stale-access-token'
        settings.openai_oauth_refresh_token = 'stale-refresh-token'
        settings.openai_oauth_account_id = 'user@example.com'
        task = Task(
            project_id='settings-test',
            task_type=task_type,
            status='PENDING',
        )
        db.session.add(task)
        db.session.commit()
        task_id = task.id

        def fail_with_missing_codex_oauth():
            raise ValueError(
                'OpenAI OAuth is not connected. Please log in with your OpenAI account in Settings.'
            )

        with patch.dict(settings_controller.TEST_FUNCTIONS, {test_name: fail_with_missing_codex_oauth}):
            settings_controller._run_test_async(
                task_id,
                test_name,
                {source_key: 'codex'},
                app,
            )

        db.session.expire_all()
        settings = Settings.get_settings()
        assert settings.openai_oauth_access_token is None
        assert settings.openai_oauth_refresh_token is None
        assert settings.openai_oauth_account_id is None

    status_response = client.get(f'/api/settings/tests/{task_id}/status')
    assert status_response.status_code == 200
    data = status_response.get_json()
    assert data['success'] is True
    assert data['data']['status'] == 'FAILED'
    assert data['data']['openai_oauth_disconnected'] is True
    assert '重新登录 OpenAI' in data['data']['error']


def test_non_codex_oauth_not_connected_error_does_not_disconnect_codex_oauth(client, app):
    """The local OAuth-not-connected text should only clear OAuth for Codex tests."""
    with app.app_context():
        from models import Settings, Task, db

        settings = Settings.get_settings()
        settings.openai_oauth_access_token = 'still-valid-access-token'
        settings.openai_oauth_refresh_token = 'still-valid-refresh-token'
        settings.openai_oauth_account_id = 'user@example.com'
        task = Task(
            project_id='settings-test',
            task_type='TEST_TEXT_MODEL',
            status='PENDING',
        )
        db.session.add(task)
        db.session.commit()
        task_id = task.id

        def fail_with_missing_oauth_text():
            raise ValueError(
                'OpenAI OAuth is not connected. Please log in with your OpenAI account in Settings.'
            )

        with patch.dict(settings_controller.TEST_FUNCTIONS, {'text-model': fail_with_missing_oauth_text}):
            settings_controller._run_test_async(
                task_id,
                'text-model',
                {'text_model_source': 'gemini'},
                app,
            )

        db.session.expire_all()
        settings = Settings.get_settings()
        assert settings.openai_oauth_access_token == 'still-valid-access-token'
        assert settings.openai_oauth_refresh_token == 'still-valid-refresh-token'
        assert settings.openai_oauth_account_id == 'user@example.com'

    status_response = client.get(f'/api/settings/tests/{task_id}/status')
    assert status_response.status_code == 200
    data = status_response.get_json()
    assert data['success'] is True
    assert data['data']['status'] == 'FAILED'
    assert 'openai_oauth_disconnected' not in data['data']


def test_unrelated_401_settings_test_does_not_disconnect_codex_oauth(client, app):
    """A non-Codex service test should not clear OAuth just because Codex is configured globally."""
    with app.app_context():
        from models import Settings, Task, db

        settings = Settings.get_settings()
        settings.openai_oauth_access_token = 'still-valid-access-token'
        settings.openai_oauth_refresh_token = 'still-valid-refresh-token'
        settings.openai_oauth_account_id = 'user@example.com'
        task = Task(
            project_id='settings-test',
            task_type='TEST_BAIDU_OCR',
            status='PENDING',
        )
        db.session.add(task)
        db.session.commit()
        task_id = task.id

        response = requests.Response()
        response.status_code = 401
        error = requests.exceptions.HTTPError(
            '401 Client Error: Unauthorized for url: https://example.com/ocr',
            response=response,
        )

        def fail_with_unrelated_401():
            raise error

        with patch.dict(settings_controller.TEST_FUNCTIONS, {'baidu-ocr': fail_with_unrelated_401}):
            settings_controller._run_test_async(
                task_id,
                'baidu-ocr',
                {'ai_provider_format': 'codex'},
                app,
            )

        db.session.expire_all()
        settings = Settings.get_settings()
        assert settings.openai_oauth_access_token == 'still-valid-access-token'
        assert settings.openai_oauth_refresh_token == 'still-valid-refresh-token'
        assert settings.openai_oauth_account_id == 'user@example.com'

    status_response = client.get(f'/api/settings/tests/{task_id}/status')
    assert status_response.status_code == 200
    data = status_response.get_json()
    assert data['success'] is True
    assert data['data']['status'] == 'FAILED'
    assert 'openai_oauth_disconnected' not in data['data']


def test_codex_test_error_text_with_4010_does_not_disconnect_oauth(client, app):
    """A non-401 number in error text should not be treated as an OAuth 401."""
    with app.app_context():
        from models import Settings, Task, db

        settings = Settings.get_settings()
        settings.openai_oauth_access_token = 'still-valid-access-token'
        settings.openai_oauth_refresh_token = 'still-valid-refresh-token'
        settings.openai_oauth_account_id = 'user@example.com'
        task = Task(
            project_id='settings-test',
            task_type='TEST_TEXT_MODEL',
            status='PENDING',
        )
        db.session.add(task)
        db.session.commit()
        task_id = task.id

        def fail_with_port_number():
            raise ValueError('Connection failed to http://localhost:4010/codex-proxy')

        with patch.dict(settings_controller.TEST_FUNCTIONS, {'text-model': fail_with_port_number}):
            settings_controller._run_test_async(
                task_id,
                'text-model',
                {'text_model_source': 'codex'},
                app,
            )

        db.session.expire_all()
        settings = Settings.get_settings()
        assert settings.openai_oauth_access_token == 'still-valid-access-token'
        assert settings.openai_oauth_refresh_token == 'still-valid-refresh-token'
        assert settings.openai_oauth_account_id == 'user@example.com'

    status_response = client.get(f'/api/settings/tests/{task_id}/status')
    data = status_response.get_json()
    assert data['data']['status'] == 'FAILED'
    assert 'openai_oauth_disconnected' not in data['data']
