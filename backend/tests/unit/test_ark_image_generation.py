"""Guard Ark's JSON generation endpoint, including reference-image tests."""
import base64
import json
from io import BytesIO

import httpx
import pytest
from PIL import Image
from openai import OpenAI
from services.ai_providers.image.openai_provider import OpenAIImageProvider


@pytest.mark.parametrize('protocol', ['auto', 'images', 'chat'])
@pytest.mark.parametrize('reference_count', [0, 1, 2])
def test_ark_seedream_uses_json_generations(protocol, reference_count):
    buffer = BytesIO()
    Image.new('RGBA', (32, 24), (255, 0, 0, 128)).save(buffer, format='PNG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    calls = []

    def handle(request):
        calls.append(request)
        assert request.url.path == '/api/plan/v3/images/generations'
        assert request.headers['content-type'] == 'application/json'
        body = json.loads(request.content)
        assert body['model'] == 'doubao-seedream-5-0-pro'
        assert body['response_format'] == 'b64_json'
        assert not {'quality', 'n', 'modalities', 'messages'} & body.keys()
        width, height = map(int, body['size'].split('x'))
        assert abs(width / height - 16 / 9) < .02
        if reference_count:
            assert len(body['image']) == reference_count
            for data_url in body['image']:
                image = Image.open(BytesIO(base64.b64decode(data_url.split(',')[1])))
                assert image.size == (32, 24)
                assert image.getpixel((0, 0))[3] == 128
        else:
            assert 'image' not in body
        return httpx.Response(200, json={'data': [{'b64_json': encoded}]})

    provider = OpenAIImageProvider('test', 'https://ark.cn-beijing.volces.com/api/plan/v3',
                                   'doubao-seedream-5-0-pro', protocol)
    provider.client.close()
    with OpenAI(api_key='test', base_url=provider.api_base,
                http_client=httpx.Client(transport=httpx.MockTransport(handle))) as client:
        provider.client = client
        refs = [Image.open(BytesIO(buffer.getvalue())) for _ in range(reference_count)]
        result = provider.generate_image('test', refs or None)
        assert result.size == (32, 24)
        assert len(calls) == 1


def test_custom_seedream_proxy_keeps_existing_routing():
    provider = OpenAIImageProvider('test', 'https://proxy.example/v1', 'doubao-seedream-5.0-pro')
    assert not provider._is_ark_seedream()
    provider.client.close()
