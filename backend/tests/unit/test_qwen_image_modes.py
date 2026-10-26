"""Qwen Image 2.1 requests use Bailian's synchronous multimodal API."""

import base64
from io import BytesIO
from types import SimpleNamespace

from dashscope import MultiModalConversation
from PIL import Image

from services.ai_providers.image.lazyllm_provider import LazyLLMImageProvider


def test_qwen_image_21_generation_and_editing_payloads(monkeypatch):
    monkeypatch.setenv('QWEN_API_KEY', 'sk-local-mode-check')
    provider = LazyLLMImageProvider(source='qwen', model='qwen-image-2.1')

    buffer = BytesIO()
    Image.new('RGBA', (512, 512), (255, 165, 0, 128)).save(buffer, format='PNG')
    image_bytes = buffer.getvalue()
    monkeypatch.setattr(provider.client, '_load_images', lambda urls: [('encoded', image_bytes)])

    calls = []

    def call_bailian(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(
            status_code=200,
            output=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(
                content=[{'image': 'https://example.com/generated.png'}],
            ))]),
        )

    monkeypatch.setattr(MultiModalConversation, 'call', staticmethod(call_bailian))

    generated = provider.generate_image('orange cat', aspect_ratio='1:1', resolution='1K')
    assert generated.size == (512, 512)
    assert generated.mode == 'RGBA'
    assert calls[0]['model'] == 'qwen-image-2.1'
    assert calls[0]['size'] == '1024*1024'
    assert calls[0]['messages'][0]['content'] == [{'text': 'orange cat'}]

    edited = provider.generate_image(
        'make it blue', ref_images=[Image.new('RGB', (512, 512), 'orange')],
        aspect_ratio='1:1', resolution='1K',
    )
    assert edited.size == (512, 512)
    content = calls[1]['messages'][0]['content']
    assert content[-1] == {'text': 'make it blue'}
    assert content[0]['image'].startswith('data:image/png;base64,')
    with Image.open(BytesIO(base64.b64decode(content[0]['image'].split(',', 1)[1]))) as reference:
        assert reference.size == (512, 512)
