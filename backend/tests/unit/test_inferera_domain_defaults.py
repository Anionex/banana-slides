import importlib.util
from pathlib import Path


def test_config_openai_api_base_defaults_to_inferera(monkeypatch):
    monkeypatch.delenv('OPENAI_API_BASE', raising=False)
    config_path = Path(__file__).resolve().parents[2] / 'config.py'
    spec = importlib.util.spec_from_file_location('inferera_default_config', config_path)
    config_module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(config_module)

    assert config_module.Config.OPENAI_API_BASE == 'https://api.inferera.com/v1'


def test_openai_provider_fallbacks_use_inferera(monkeypatch):
    from services import ai_providers

    monkeypatch.setenv('AI_PROVIDER_FORMAT', 'openai')
    monkeypatch.setenv('OPENAI_API_KEY', 'test-key')
    monkeypatch.delenv('OPENAI_API_BASE', raising=False)
    monkeypatch.delenv('TEXT_API_BASE', raising=False)

    assert ai_providers._build_provider_config()['api_base'] == 'https://api.inferera.com/v1'

    monkeypatch.setenv('TEXT_MODEL_SOURCE', 'openai')
    assert ai_providers._get_model_type_provider_config('text')['api_base'] == 'https://api.inferera.com/v1'
