"""Tests for research service provider mapping."""
import pytest
from unittest.mock import patch, MagicMock


class TestBuildResearchEnv:
    """Test _build_research_env maps banana-slides config to gpt-researcher env vars."""

    def test_gemini_provider(self):
        from services.research_service import _build_research_env
        env = _build_research_env(
            provider_format='gemini',
            text_model='gemini-2.0-flash',
            api_key='test-google-key',
            api_base='',
            tavily_api_key='',
        )
        assert env['SMART_LLM'] == 'google_genai:gemini-2.0-flash'
        assert env['FAST_LLM'] == 'google_genai:gemini-2.0-flash'
        assert env['STRATEGIC_LLM'] == 'google_genai:gemini-2.0-flash'
        assert env['GOOGLE_API_KEY'] == 'test-google-key'
        assert env['RETRIEVER'] == 'duckduckgo'

    def test_openai_provider(self):
        from services.research_service import _build_research_env
        env = _build_research_env(
            provider_format='openai',
            text_model='gpt-4o',
            api_key='test-openai-key',
            api_base='https://api.openai.com/v1',
            tavily_api_key='',
        )
        assert env['SMART_LLM'] == 'openai:gpt-4o'
        assert env['FAST_LLM'] == 'openai:gpt-4o'
        assert env['OPENAI_API_KEY'] == 'test-openai-key'
        assert env['RETRIEVER'] == 'duckduckgo'

    def test_openai_custom_base(self):
        from services.research_service import _build_research_env
        env = _build_research_env(
            provider_format='openai',
            text_model='gpt-4o',
            api_key='test-key',
            api_base='https://custom.api.com/v1',
            tavily_api_key='',
        )
        assert env['OPENAI_BASE_URL'] == 'https://custom.api.com/v1'

    def test_anthropic_provider(self):
        from services.research_service import _build_research_env
        env = _build_research_env(
            provider_format='anthropic',
            text_model='claude-sonnet-4-20250514',
            api_key='test-anthropic-key',
            api_base='',
            tavily_api_key='',
        )
        assert env['SMART_LLM'] == 'anthropic:claude-sonnet-4-20250514'
        assert env['ANTHROPIC_API_KEY'] == 'test-anthropic-key'

    def test_tavily_when_key_present(self):
        from services.research_service import _build_research_env
        env = _build_research_env(
            provider_format='gemini',
            text_model='gemini-2.0-flash',
            api_key='test-key',
            api_base='',
            tavily_api_key='tvly-test-key',
        )
        assert env['RETRIEVER'] == 'tavily'
        assert env['TAVILY_API_KEY'] == 'tvly-test-key'

    def test_duckduckgo_when_no_tavily_key(self):
        from services.research_service import _build_research_env
        env = _build_research_env(
            provider_format='gemini',
            text_model='gemini-2.0-flash',
            api_key='test-key',
            api_base='',
            tavily_api_key='',
        )
        assert env['RETRIEVER'] == 'duckduckgo'
        assert 'TAVILY_API_KEY' not in env

    def test_lazyllm_vendor(self):
        from services.research_service import _build_research_env
        env = _build_research_env(
            provider_format='lazyllm',
            text_model='qwen-plus',
            api_key='lazyllm-key',
            api_base='https://api.lazyllm.com/v1',
            tavily_api_key='',
            text_model_source='qwen',
        )
        assert env['SMART_LLM'] == 'openai:qwen-plus'
        assert env['OPENAI_API_KEY'] == 'lazyllm-key'
        assert env['OPENAI_BASE_URL'] == 'https://api.lazyllm.com/v1'
