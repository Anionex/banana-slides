"""
Tests for lazyllm vendor inference in _build_provider_config.

Covers the bug fix: when AI_PROVIDER_FORMAT=lazyllm and no per-model
source is explicitly set, infer vendor from configured {VENDOR}_API_KEY
env vars instead of hardcoding 'deepseek'.
"""

import os
from unittest.mock import patch

import pytest


def test_infer_lazyllm_vendor_returns_configured_vendor():
    """_infer_lazyllm_vendor should return the first configured vendor by priority."""
    from services.ai_providers import _infer_lazyllm_vendor

    with patch.dict(os.environ, {'DOUBAO_API_KEY': 'test-key'}, clear=False):
        result = _infer_lazyllm_vendor('deepseek')
    assert result == 'doubao'


def test_infer_lazyllm_vendor_returns_fallback_when_no_keys():
    """_infer_lazyllm_vendor should return fallback when no vendor keys configured."""
    from services.ai_providers import _infer_lazyllm_vendor

    # Remove all lazyllm vendor keys from env
    env_without_vendors = {k: v for k, v in os.environ.items()
                           if not any(k == f'{v2.upper()}_API_KEY'
                                      for v2 in ['doubao', 'qwen', 'deepseek', 'glm',
                                                  'siliconflow', 'sensenova', 'minimax', 'kimi'])}
    with patch.dict(os.environ, env_without_vendors, clear=True):
        result = _infer_lazyllm_vendor('deepseek')
    assert result == 'deepseek'


def test_build_provider_config_lazyllm_uses_configured_doubao_key():
    """
    When AI_PROVIDER_FORMAT=lazyllm, DOUBAO_API_KEY is set, and no explicit
    TEXT_MODEL_SOURCE is configured, _build_provider_config should use 'doubao'
    as text_source — not the hardcoded default 'deepseek'.

    This is the regression test for the bug: users who selected doubao as their
    global lazyllm provider got 'api key is required' because the code fell back
    to 'deepseek' which had no API key configured.
    """
    from flask import Flask
    from services.ai_providers import _build_provider_config

    app = Flask(__name__)
    app.config['AI_PROVIDER_FORMAT'] = 'lazyllm'
    # Explicitly no TEXT_MODEL_SOURCE or IMAGE_MODEL_SOURCE in app.config

    with app.app_context():
        with patch.dict(os.environ, {'DOUBAO_API_KEY': 'doubao-key-123'}, clear=False):
            # Remove any vendor source env vars that could interfere
            env = {k: v for k, v in os.environ.items()
                   if k not in ('TEXT_MODEL_SOURCE', 'IMAGE_MODEL_SOURCE')}
            with patch.dict(os.environ, env, clear=True):
                os.environ['DOUBAO_API_KEY'] = 'doubao-key-123'
                config = _build_provider_config()

    assert config['format'] == 'lazyllm'
    assert config['text_source'] == 'doubao', (
        f"Expected 'doubao' but got '{config['text_source']}'. "
        "Bug: hardcoded default 'deepseek' was used instead of inferring from DOUBAO_API_KEY."
    )
    assert config['image_source'] == 'doubao'


def test_build_provider_config_lazyllm_respects_explicit_text_model_source():
    """Explicit TEXT_MODEL_SOURCE in app.config must take priority over inferred vendor."""
    from flask import Flask
    from services.ai_providers import _build_provider_config

    app = Flask(__name__)
    app.config['AI_PROVIDER_FORMAT'] = 'lazyllm'
    app.config['TEXT_MODEL_SOURCE'] = 'qwen'  # explicit per-model override

    with app.app_context():
        with patch.dict(os.environ, {'DOUBAO_API_KEY': 'doubao-key-123'}, clear=False):
            config = _build_provider_config()

    assert config['text_source'] == 'qwen'  # explicit wins over inferred
