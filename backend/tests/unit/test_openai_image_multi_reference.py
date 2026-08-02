"""Regression tests for native OpenAI Images API reference forwarding."""

import base64
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from services.ai_providers.image.openai_provider import OpenAIImageProvider


def _make_b64_png() -> str:
    image = Image.new('RGB', (16, 16), color='white')
    buffer = BytesIO()
    image.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()


def _make_provider(model: str = 'gpt-image-2') -> OpenAIImageProvider:
    with patch('services.ai_providers.image.openai_provider.OpenAI'):
        provider = OpenAIImageProvider(
            api_key='test',
            api_base='http://test',
            model=model,
            image_api_protocol='auto',
        )
    provider.client.images.edit = MagicMock(
        return_value=SimpleNamespace(
            data=[SimpleNamespace(b64_json=_make_b64_png(), url=None)]
        )
    )
    return provider


def _read_color(image_file: BytesIO) -> tuple[int, int, int]:
    image_file.seek(0)
    return Image.open(image_file).convert('RGB').getpixel((0, 0))


def test_gpt_image_forwards_template_and_material_references_in_order():
    provider = _make_provider()
    template = Image.new('RGB', (8, 8), color='red')
    user_material = Image.new('RGB', (8, 8), color='blue')

    result = provider.generate_image(
        prompt='Use the template style and the supplied user material.',
        ref_images=[template, user_material],
        aspect_ratio='1:1',
        resolution='1K',
    )

    assert isinstance(result, Image.Image)
    request = provider.client.images.edit.call_args.kwargs
    assert isinstance(request['image'], list)
    assert [image.name for image in request['image']] == ['image_1.png', 'image_2.png']
    assert [_read_color(image) for image in request['image']] == [
        (255, 0, 0),
        (0, 0, 255),
    ]


def test_gpt_image_keeps_single_reference_proxy_compatible():
    provider = _make_provider()

    provider.generate_image(
        prompt='Use this reference.',
        ref_images=[Image.new('RGB', (8, 8), color='green')],
        aspect_ratio='1:1',
        resolution='1K',
    )

    request = provider.client.images.edit.call_args.kwargs
    assert isinstance(request['image'], BytesIO)
    assert request['image'].name == 'image.png'


def test_gpt_image_accepts_palette_mode_reference():
    provider = _make_provider()
    palette_image = Image.new('P', (8, 8), color=1)
    palette_image.putpalette([0, 0, 0, 0, 255, 0] + [0, 0, 0] * 254)

    provider.generate_image(
        prompt='Use this palette image.',
        ref_images=[palette_image],
        aspect_ratio='1:1',
        resolution='1K',
    )

    request = provider.client.images.edit.call_args.kwargs
    assert Image.open(request['image']).mode == 'RGBA'


def test_forced_images_protocol_preserves_refs_for_custom_proxy_model():
    provider = _make_provider(model='custom-image-edit-model')
    provider.image_api_protocol = 'images'

    provider.generate_image(
        prompt='Use all references.',
        ref_images=[
            Image.new('RGB', (8, 8), color='red'),
            Image.new('RGB', (8, 8), color='blue'),
        ],
        aspect_ratio='1:1',
        resolution='1K',
    )

    request = provider.client.images.edit.call_args.kwargs
    assert isinstance(request['image'], list)
    assert len(request['image']) == 2


@pytest.mark.parametrize('invalid_size', ['auto', None, '0x1024', '-10x1024'])
def test_invalid_edit_size_falls_back_to_square(caplog, invalid_size):
    provider = _make_provider()
    provider._resolve_size = MagicMock(return_value=invalid_size)

    provider.generate_image(
        prompt='Use this reference.',
        ref_images=[Image.new('RGB', (8, 8), color='green')],
        aspect_ratio='1:1',
        resolution='1K',
    )

    request = provider.client.images.edit.call_args.kwargs
    assert request['size'] == '1024x1024'
    assert Image.open(request['image']).size == (1024, 1024)
    assert "falling back to 1024x1024" in caplog.text


def test_gpt_image_rejects_more_than_sixteen_references():
    provider = _make_provider()
    references = [Image.new('RGB', (8, 8), color='white') for _ in range(17)]

    with pytest.raises(Exception, match='at most 16 reference images, got 17'):
        provider.generate_image(
            prompt='Too many references.',
            ref_images=references,
            aspect_ratio='1:1',
            resolution='1K',
        )

    provider.client.images.edit.assert_not_called()


def test_dall_e_2_keeps_documented_single_reference_limit(caplog):
    provider = _make_provider(model='dall-e-2')
    references = [
        Image.new('RGB', (8, 8), color='red'),
        Image.new('RGB', (8, 8), color='blue'),
    ]

    provider.generate_image(
        prompt='Use this reference.',
        ref_images=references,
        aspect_ratio='1:1',
        resolution='1K',
    )

    request = provider.client.images.edit.call_args.kwargs
    assert isinstance(request['image'], BytesIO)
    assert _read_color(request['image']) == (255, 0, 0)
    assert 'ignoring 1 additional image(s)' in caplog.text
