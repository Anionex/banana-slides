"""Web research service using gpt-researcher."""
import asyncio
import logging
import os
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# Provider format mapping: banana-slides format → gpt-researcher LLM prefix
_PROVIDER_LLM_PREFIX = {
    'gemini': 'google_genai',
    'openai': 'openai',
    'anthropic': 'anthropic',
    'codex': 'openai',
}

# Provider format → which env var holds the API key for gpt-researcher
_PROVIDER_API_KEY_ENV = {
    'gemini': 'GOOGLE_API_KEY',
    'openai': 'OPENAI_API_KEY',
    'anthropic': 'ANTHROPIC_API_KEY',
    'codex': 'OPENAI_API_KEY',
}


def _build_research_env(
    provider_format: str,
    text_model: str,
    api_key: str,
    api_base: str,
    tavily_api_key: str,
    text_model_source: str = '',
) -> dict:
    """
    Map banana-slides provider config to gpt-researcher environment variables.

    Returns a dict of env vars to set before creating GPTResearcher.
    """
    env = {}
    fmt = (provider_format or 'gemini').lower()

    # Determine LLM prefix and API key env var
    if fmt in _PROVIDER_LLM_PREFIX:
        prefix = _PROVIDER_LLM_PREFIX[fmt]
        key_env = _PROVIDER_API_KEY_ENV[fmt]
    elif fmt == 'lazyllm' or text_model_source:
        # LazyLLM vendors use OpenAI-compatible endpoints
        prefix = 'openai'
        key_env = 'OPENAI_API_KEY'
    else:
        # Unknown format, try openai-compatible
        prefix = 'openai'
        key_env = 'OPENAI_API_KEY'

    llm_value = f'{prefix}:{text_model}'
    env['SMART_LLM'] = llm_value
    env['FAST_LLM'] = llm_value
    env['STRATEGIC_LLM'] = llm_value

    if api_key:
        env[key_env] = api_key

    # Set custom base URL for OpenAI-compatible providers
    if api_base and prefix == 'openai':
        env['OPENAI_BASE_URL'] = api_base

    # Search engine: Tavily if key present, else DuckDuckGo
    if tavily_api_key:
        env['RETRIEVER'] = 'tavily'
        env['TAVILY_API_KEY'] = tavily_api_key
    else:
        env['RETRIEVER'] = 'duckduckgo'

    return env
