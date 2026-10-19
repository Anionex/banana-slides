"""Streaming limits must be request-local and release upstream resources."""
from threading import Event
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from services.ai_providers.text.stream_control import stream_limits, stream_timeout, stream_stopped
from services.ai_providers.text.openai_provider import OpenAITextProvider
from services.ai_providers.text.anthropic_provider import AnthropicTextProvider
from services.ai_providers.text.genai_provider import GenAITextProvider


def test_nested_limits_restore_outer_request_even_after_error():
    outer, inner = Event(), Event()
    assert stream_timeout() is None
    with stream_limits(20, outer):
        with pytest.raises(ValueError), stream_limits(5, inner):
            inner.set()
            assert stream_timeout() == 5 and stream_stopped()
            raise ValueError('cancelled request')
        assert stream_timeout() == 20 and not stream_stopped()
    assert stream_timeout() is None and not stream_stopped()


@pytest.mark.parametrize('kind', ['openai', 'anthropic', 'genai'])
def test_provider_stops_and_closes_without_mutating_shared_client(kind):
    stopped, closed = Event(), Event()

    def chunks():
        try:
            for word in ['first', 'late']:
                if kind == 'openai':
                    yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=word))])
                elif kind == 'genai':
                    yield SimpleNamespace(text=word)
                else:
                    yield word
        finally:
            closed.set()

    classes = {'openai': OpenAITextProvider, 'anthropic': AnthropicTextProvider, 'genai': GenAITextProvider}
    provider = classes[kind].__new__(classes[kind])
    provider.model = 'test-model'
    provider.provider_format = 'openai'
    provider.request_timeout_seconds = 100
    provider.max_tokens = 1024
    provider.client = shared_client = MagicMock()
    bounded_client = shared_client.with_options.return_value
    upstream = chunks()
    if kind == 'openai':
        bounded_client.chat.completions.create.return_value = upstream
    elif kind == 'anthropic':
        manager = bounded_client.messages.stream.return_value
        manager.__enter__.return_value.text_stream = upstream
        manager.__exit__.side_effect = lambda *_args: upstream.close()
    else:
        shared_client.models.generate_content_stream.return_value = upstream

    with stream_limits(12, stopped):
        result = provider.generate_text_stream('prompt')
        assert next(result) == 'first'
        stopped.set()
        assert list(result) == []
    assert closed.is_set()
    assert provider.client is shared_client
    if kind == 'genai':
        config = shared_client.models.generate_content_stream.call_args.kwargs['config']
        assert config.http_options.timeout == 12000
        assert config.http_options.retry_options.attempts == 1
        assert config.thinking_config is None
    else:
        shared_client.with_options.assert_called_once_with(timeout=12, max_retries=0)


@pytest.mark.parametrize('budget', [0, 1024])
def test_genai_without_stream_limits_preserves_existing_thinking_defaults(budget):
    provider = GenAITextProvider.__new__(GenAITextProvider)
    provider.model = 'gemini-3-flash-preview'
    provider.client = MagicMock()
    provider.client.models.generate_content_stream.return_value = (x for x in [])
    assert list(provider.generate_text_stream('prompt', budget)) == []
    config = provider.client.models.generate_content_stream.call_args.kwargs['config']
    if budget == 0:
        assert config is None
    else:
        assert config.thinking_config.thinking_budget == budget
        assert config.http_options is None
