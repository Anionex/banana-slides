"""Validate the actual serialized SDK request, not only mock call arguments."""
import json
import logging

import httpx
import pytest
from openai import OpenAI

from services.ai_providers.text.openai_provider import OpenAITextProvider


@pytest.mark.parametrize('budget,expected', [(0, 'disabled'), (1024, 'enabled'), (-1, None)])
@pytest.mark.parametrize('stream', [False, True])
def test_ark_serializes_thinking_switch(budget, expected, stream, caplog):
    captured = []

    def handle(request):
        body = json.loads(request.content)
        captured.append(body)
        if not stream:
            return httpx.Response(200, json={
                'id': 'test', 'object': 'chat.completion', 'created': 0, 'model': 'test',
                'choices': [{'index': 0, 'message': {'role': 'assistant', 'content': 'answer'}, 'finish_reason': 'stop'}],
            })
        chunks = [{'reasoning_content': 'private reasoning'}, {'content': 'answer'}]
        data = ''.join('data: ' + json.dumps({
            'id': 'test', 'object': 'chat.completion.chunk', 'created': 0, 'model': 'test',
            'choices': [{'index': 0, 'delta': delta, 'finish_reason': None}],
        }) + '\n\n' for delta in chunks) + 'data: [DONE]\n\n'
        return httpx.Response(200, text=data, headers={'content-type': 'text/event-stream', 'x-request-id': 'test-request'})

    provider = OpenAITextProvider('test-only-key', 'https://example.invalid/v1',
                                  'doubao-seed-2.1-turbo', provider_format='volcengine')
    provider.client.close()
    provider.client = OpenAI(api_key='test-only-key', base_url='https://example.invalid/v1',
                             http_client=httpx.Client(transport=httpx.MockTransport(handle)))
    try:
        with caplog.at_level(logging.INFO):
            result = ''.join(provider.generate_text_stream('private input', budget)) if stream else provider.generate_text('private input', budget)
        assert result == 'answer'
        assert captured[0].get('thinking') == ({'type': expected} if expected else None)
        if stream:
            assert 'first_chunk_s=' in caplog.text and 'first_text_s=' in caplog.text
            assert 'reasoning_chars=17' in caplog.text
            assert 'private input' not in caplog.text and 'private reasoning' not in caplog.text
    finally:
        provider.client.close()


@pytest.mark.parametrize('fmt,model', [('openai', 'doubao-seed-2.1-turbo'), ('volcengine', 'unverified-model')])
def test_unrelated_models_keep_existing_request_contract(fmt, model):
    provider = OpenAITextProvider('test-key', 'https://example.invalid', model, provider_format=fmt)
    try:
        assert provider._thinking_options(0) == {}
        assert provider._thinking_options(1024) == {}
    finally:
        provider.client.close()
