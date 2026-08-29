"""Image-source fallback for LazyLLM vendors without text2image capability."""

import pytest

from services.ai_providers import _build_provider_config


pytestmark = pytest.mark.unit


def test_lazyllm_image_source_falls_back_to_capable_vendor(monkeypatch):
    """Global format picks a vendor without text2image -> image falls back to doubao."""
    monkeypatch.delenv('TEXT_MODEL_SOURCE', raising=False)
    monkeypatch.delenv('IMAGE_MODEL_SOURCE', raising=False)
    monkeypatch.setenv('AI_PROVIDER_FORMAT', 'ppio')
    cfg = _build_provider_config()
    assert cfg['text_source'] == 'ppio'
    assert cfg['image_source'] == 'doubao'


def test_lazyllm_image_source_keeps_capable_vendor(monkeypatch):
    monkeypatch.delenv('TEXT_MODEL_SOURCE', raising=False)
    monkeypatch.delenv('IMAGE_MODEL_SOURCE', raising=False)
    monkeypatch.setenv('AI_PROVIDER_FORMAT', 'qwen')
    cfg = _build_provider_config()
    assert cfg['image_source'] == 'qwen'


def test_lazyllm_image_source_setting_takes_priority(monkeypatch):
    monkeypatch.setenv('TEXT_MODEL_SOURCE', 'kimi')
    monkeypatch.setenv('IMAGE_MODEL_SOURCE', 'glm')
    monkeypatch.setenv('AI_PROVIDER_FORMAT', 'ppio')
    cfg = _build_provider_config()
    assert cfg['text_source'] == 'kimi'
    assert cfg['image_source'] == 'glm'
