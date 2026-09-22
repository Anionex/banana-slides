"""Verify thinking controls in the actual Google SDK wire payload, for every text path."""
import json
from threading import Event

import httpx
import pytest
from google import genai
from google.genai import types
from PIL import Image

from services.ai_providers.text import genai_provider
from services.ai_providers.text.stream_control import stream_limits


@pytest.mark.parametrize('method', ['generate_text', 'generate_with_image', 'generate_text_stream'])
@pytest.mark.parametrize('model,budget,expected', [
    ('gemini-3-flash-preview', 0, {'thinkingLevel': 'minimal'}),
    ('models/gemini-3-flash-preview', 0, {'thinkingLevel': 'minimal'}),
    ('gemini-3.1-flash-lite-preview', 0, {'thinkingLevel': 'minimal'}),
    ('gemini-3-pro-preview', 0, {'thinkingLevel': 'low'}),
    ('gemini-3.1-pro-preview', 0, {'thinkingLevel': 'low'}),
    ('gemini-2.5-flash', 0, {'thinkingBudget': 0}),
    ('gemini-2.5-flash-lite-preview-06-17', 0, {'thinkingBudget': 0}),
    ('gemini-2.5-pro', 0, {'thinkingBudget': 128}),
    ('gemini-2.0-flash', 0, None),
    ('custom-text-alias', 0, None),
    ('gemini-3.1-flash-image-preview', 0, None),
    ('gemini-3.7-flash', 0, None),
    ('gemini-3-flash-preview', 1024, {'thinkingBudget': 1024}),
    ('gemini-2.5-flash', 1024, {'thinkingBudget': 1024}),
])
def test_thinking_wire_payload(monkeypatch, tmp_path, method, model, budget, expected):
    requests = []
    response = {'candidates': [{'content': {'parts': [{'text': 'result'}], 'role': 'model'},
                                'finishReason': 'STOP'}]}

    def handle(request):
        requests.append(json.loads(request.content))
        if ':streamGenerateContent' in request.url.path:
            return httpx.Response(200, headers={'content-type': 'text/event-stream'},
                                  text='data: ' + json.dumps(response) + '\n\n')
        return httpx.Response(200, json=response)

    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        client = genai.Client(api_key='test-only', http_options=types.HttpOptions(
            base_url='https://sdk-test.invalid', httpx_client=transport))
        monkeypatch.setattr(genai_provider, 'make_genai_client', lambda **kwargs: client)
        provider = genai_provider.GenAITextProvider(model=model)
        if method == 'generate_with_image':
            image = tmp_path / 'input.png'
            Image.new('RGB', (8, 8), 'yellow').save(image)
            result = provider.generate_with_image('Describe', str(image), thinking_budget=budget)
        elif method == 'generate_text_stream':
            with stream_limits(240, Event()):
                result = ''.join(provider.generate_text_stream('Outline', thinking_budget=budget))
        else:
            result = provider.generate_text('Outline', thinking_budget=budget)
        assert result == 'result'
        assert len(requests) == 1
        actual = requests[0].get('generationConfig', {}).get('thinkingConfig')
        if actual is not None:
            actual = {k.replace('thinking_', 'thinking').lower(): str(v).lower() for k, v in actual.items()}
        if expected is not None:
            expected = {k.lower(): str(v).lower() for k, v in expected.items()}
        assert actual == expected
        client.close()
