"""Output limits must reach actual SDK requests and survive settings changes."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from flask import Flask
from PIL import Image

from config import Config
from controllers.settings_controller import temporary_settings_override
from services.ai_providers.text.base import get_text_output_limit
from services.ai_providers.text.openai_provider import OpenAITextProvider
from services.ai_providers.text.anthropic_provider import AnthropicTextProvider
from services.ai_providers.text.genai_provider import GenAITextProvider
from services.ai_providers.text.lazyllm_provider import LazyLLMTextProvider


@pytest.fixture
def image_path(tmp_path):
    path = tmp_path / 'test.png'
    Image.new('RGB', (8, 8)).save(path)
    return str(path)


@pytest.mark.parametrize('model,key', [
    ('claude-opus-5-5', 'max_tokens'),
    ('gemini-3-flash-preview', 'max_tokens'),
    ('gpt-4o', 'max_tokens'),
    ('gpt-5.6-sol', 'max_completion_tokens'),
    ('o3', 'max_completion_tokens'),
    ('openai/o4-mini', 'max_completion_tokens'),
])
@pytest.mark.parametrize('method', ['generate_text', 'generate_text_stream', 'generate_with_image'])
def test_openai_requests_use_limit(model, key, method, image_path):
    app = Flask(__name__)
    app.config['TEXT_MAX_OUTPUT_TOKENS'] = 32768
    provider = OpenAITextProvider.__new__(OpenAITextProvider)
    provider.model, provider.client = model, MagicMock()
    create = provider.client.chat.completions.create
    create.return_value = (iter([]) if method == 'generate_text_stream' else
                           SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='ok'))]))
    with app.app_context():
        args = ('prompt', image_path) if method == 'generate_with_image' else ('prompt',)
        result = getattr(provider, method)(*args)
        if method == 'generate_text_stream':
            list(result)
    kwargs = create.call_args.kwargs
    assert kwargs[key] == 32768
    assert ('max_completion_tokens' if key == 'max_tokens' else 'max_tokens') not in kwargs


@pytest.mark.parametrize('kind', ['anthropic', 'gemini', 'lazyllm'])
@pytest.mark.parametrize('method', ['generate_text', 'generate_text_stream', 'generate_with_image'])
def test_other_provider_requests_use_limit(kind, method, image_path):
    classes = {'anthropic': AnthropicTextProvider, 'gemini': GenAITextProvider, 'lazyllm': LazyLLMTextProvider}
    provider = classes[kind].__new__(classes[kind])
    provider.model, provider.client = 'test-model', MagicMock()
    provider._is_vlm_only = True
    provider.client.return_value = 'ok'
    provider.client.messages.create.return_value = SimpleNamespace(content=[SimpleNamespace(text='ok')])
    provider.client.messages.stream.return_value.__enter__.return_value.text_stream = iter(['ok'])
    provider.client.models.generate_content.return_value = SimpleNamespace(text='ok')
    provider.client.models.generate_content_stream.return_value = iter([SimpleNamespace(text='ok')])
    app = Flask(__name__)
    app.config['TEXT_MAX_OUTPUT_TOKENS'] = 16384
    with app.app_context():
        args = ('prompt', image_path) if method == 'generate_with_image' else ('prompt',)
        result = getattr(provider, method)(*args)
        if method == 'generate_text_stream':
            list(result)
    if kind == 'anthropic':
        fn = provider.client.messages.stream if method == 'generate_text_stream' else provider.client.messages.create
        assert fn.call_args.kwargs['max_tokens'] == 16384
    elif kind == 'gemini':
        fn = provider.client.models.generate_content_stream if method == 'generate_text_stream' else provider.client.models.generate_content
        assert fn.call_args.kwargs['config'].max_output_tokens == 16384
    else:
        assert provider.client.call_args.kwargs['max_tokens'] == 16384


def test_settings_save_reload_reset_and_cached_provider(client, monkeypatch):
    from models import Settings, db
    monkeypatch.setattr(Config, 'TEXT_MAX_OUTPUT_TOKENS', 32768)
    provider = OpenAITextProvider.__new__(OpenAITextProvider)
    provider.model = 'claude-opus-5-5'
    assert client.get('/api/settings').json['data']['text_max_output_tokens'] == 32768
    assert client.put('/api/settings', json={'text_max_output_tokens': 16384}).status_code == 200
    db.session.remove()
    assert Settings.get_settings().text_max_output_tokens == 16384
    assert client.get('/api/settings').json['data']['text_max_output_tokens'] == 16384
    assert provider._output_limit_params() == {'max_tokens': 16384}
    # Startup must also reload the persisted value.
    from app import _load_settings_to_config
    from flask import current_app
    current_app.config['TEXT_MAX_OUTPUT_TOKENS'] = 1
    _load_settings_to_config(current_app)
    assert get_text_output_limit() == 16384
    assert client.post('/api/settings/reset').status_code == 200
    assert client.get('/api/settings').json['data']['text_max_output_tokens'] == 32768
    assert provider._output_limit_params() == {'max_tokens': 32768}


@pytest.mark.parametrize('value', [0, -1, 1.5, True, '32768', None, 2147483648])
def test_invalid_limit_does_not_change_saved_setting(client, value):
    assert client.put('/api/settings', json={'text_max_output_tokens': 16384}).status_code == 200
    assert client.put('/api/settings', json={'text_max_output_tokens': value}).status_code == 400
    assert client.get('/api/settings').json['data']['text_max_output_tokens'] == 16384


def test_unsaved_service_test_limit_is_restored():
    app = Flask(__name__)
    app.config['TEXT_MAX_OUTPUT_TOKENS'] = 32768
    with app.app_context():
        with temporary_settings_override({'text_max_output_tokens': 4096}):
            assert get_text_output_limit() == 4096
        assert get_text_output_limit() == 32768


def test_existing_database_migration_preserves_settings(tmp_path):
    migration = Path(__file__).parents[2] / 'migrations/versions/d84c2a7f9130_add_text_output_limit.py'
    spec = importlib.util.spec_from_file_location('output_limit_migration', migration)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    engine = sa.create_engine(f'sqlite:///{tmp_path}/old.db')
    with engine.begin() as connection:
        connection.execute(sa.text('CREATE TABLE settings (id INTEGER PRIMARY KEY, text_model TEXT)'))
        connection.execute(sa.text("INSERT INTO settings VALUES (1, 'existing-model')"))
        module.op = Operations(MigrationContext.configure(connection))
        module.upgrade()
        module.upgrade()  # Desktop schema repair may already have added it.
        assert connection.execute(sa.text('SELECT text_model, text_max_output_tokens FROM settings')).one() == ('existing-model', None)
        module.downgrade()
        assert connection.execute(sa.text('SELECT text_model FROM settings')).scalar_one() == 'existing-model'
