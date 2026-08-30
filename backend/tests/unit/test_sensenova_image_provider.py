"""Tests for SenseNova's native JSON image API adapter."""

import base64
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from services.ai_providers.image.openai_provider import OpenAIImageProvider


def _png_data_url(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format='PNG')
    return f'data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}'


def _provider(model: str = 'sensenova-u1.5-lite') -> OpenAIImageProvider:
    with patch('services.ai_providers.image.openai_provider.OpenAI'):
        provider = OpenAIImageProvider(
            api_key='test-key',
            api_base='https://token.sensenova.cn/v1',
            model=model,
            image_api_protocol='auto',
        )
    provider.client = MagicMock()
    return provider


def _response(payload, status_code: int = 200) -> MagicMock:
    response = MagicMock()
    response.status_code = status_code
    response.json.return_value = payload
    return response


def test_sensenova_generation_uses_json_images_api():
    provider = _provider()
    response = _response({
        'data': [{'url': _png_data_url(Image.new('RGB', (256, 256), color='red'))}],
        'output_format': 'png',
    })

    with patch('services.ai_providers.image.openai_provider.requests.post', return_value=response) as post:
        result = provider.generate_image(
            'a red apple',
            aspect_ratio='16:9',
            resolution='2K',
        )

    assert isinstance(result, Image.Image)
    post.assert_called_once()
    assert post.call_args.args[0] == 'https://token.sensenova.cn/v1/images/generations'
    body = post.call_args.kwargs['json']
    assert body['model'] == 'sensenova-u1.5-lite'
    assert body['prompt'] == 'a red apple'
    assert body['watermark'] is False
    assert body['prompt_extend'] is True
    assert body['response_format'] == 'url'
    assert body['output_format'] == 'png'
    assert body['size'] == '2048x1152'
    provider.client.chat.completions.create.assert_not_called()
    provider.client.images.with_raw_response.generate.assert_not_called()
    provider.client.images.with_raw_response.edit.assert_not_called()


def test_sensenova_edit_uses_json_image_urls():
    provider = _provider()
    response = _response({
        'data': [{'url': _png_data_url(Image.new('RGB', (256, 256), color='blue'))}],
        'output_format': 'png',
    })

    with patch('services.ai_providers.image.openai_provider.requests.post', return_value=response) as post:
        result = provider.generate_image(
            'make it blue',
            ref_images=[Image.new('RGB', (256, 256), color='red')],
            aspect_ratio='1:1',
            resolution='1K',
        )

    assert isinstance(result, Image.Image)
    post.assert_called_once()
    assert post.call_args.args[0] == 'https://token.sensenova.cn/v1/images/edits'
    body = post.call_args.kwargs['json']
    assert body['model'] == 'sensenova-u1.5-lite'
    assert body['prompt'] == 'make it blue'
    assert body['watermark'] is False
    assert body['prompt_extend'] is True
    assert len(body['images']) == 1
    assert body['images'][0]['image_url'].startswith('data:image/png;base64,')
    assert 'size' not in body
    provider.client.images.with_raw_response.edit.assert_not_called()


def test_sensenova_api_error_keeps_diagnostic_message():
    provider = _provider()
    response = _response(
        {'error': {'message': 'invalid images[0].image_url', 'code': '3'}},
        status_code=400,
    )

    with patch('services.ai_providers.image.openai_provider.requests.post', return_value=response) as post:
        with pytest.raises(Exception, match='invalid images\\[0\\]\\.image_url'):
            provider.generate_image('a red apple')
    post.assert_called_once()


def test_sensenova_retries_transient_http_error():
    provider = _provider()
    failed = _response(
        {'error': {'message': 'temporarily unavailable', 'code': '5'}},
        status_code=429,
    )
    success = _response({
        'data': [{'url': _png_data_url(Image.new('RGB', (256, 256), color='green'))}],
        'output_format': 'png',
    })

    with patch(
        'services.ai_providers.image.openai_provider.requests.post',
        side_effect=[failed, success],
    ) as post:
        result = provider.generate_image(
            'a green apple',
            aspect_ratio='16:9',
            resolution='2K',
        )

    assert isinstance(result, Image.Image)
    assert post.call_count == 2


def _assert_sensenova_size(size: str, resolution: str = '2K'):
    width, height = (int(part) for part in size.split('x'))
    assert width % 32 == 0, f'{size} width is not 32-aligned'
    assert height % 32 == 0, f'{size} height is not 32-aligned'
    assert 512 <= width <= 4096, f'{size} width out of range'
    assert 512 <= height <= 4096, f'{size} height out of range'
    assert round(width / height, 4) <= 3.0001, f'{size} exceeds 3:1'
    assert round(height / width, 4) <= 3.0001, f'{size} exceeds 1:3'


@pytest.mark.parametrize(
    'ratio, expected',
    [
        ('1:1', '2048x2048'),
        ('16:9', '2048x1152'),
        ('9:16', '1152x2048'),
        ('3:2', '2048x1376'),
        ('2:3', '1376x2048'),
        ('4:3', '2048x1536'),
        ('3:4', '1536x2048'),
        ('4:5', '1632x2048'),
        ('5:4', '2048x1632'),
        ('21:9', '2048x864'),
        ('9:21', '864x2048'),
    ],
)
def test_sensenova_u15_lite_resolution_uses_supported_size(ratio, expected):
    provider = _provider(model='sensenova-u1.5-lite')
    assert provider._resolve_size(ratio, '2K') == expected
    _assert_sensenova_size(expected)


def test_sensenova_u15_lite_4k_stays_within_api_bounds():
    provider = _provider(model='sensenova-u1.5-lite')
    assert provider._resolve_size('16:9', '4K') == '4096x2304'
    _assert_sensenova_size(provider._resolve_size('8:1', '4K'), '4K')
    _assert_sensenova_size(provider._resolve_size('1:8', '4K'), '4K')
    _assert_sensenova_size(provider._resolve_size('1:1', '4K'), '4K')


@pytest.mark.parametrize(
    'ratio, expected',
    [
        ('1:1', '2048x2048'),
        ('16:9', '2752x1536'),
        ('9:16', '1536x2752'),
        ('2:3', '1664x2496'),
        ('3:2', '2496x1664'),
        ('3:4', '1760x2368'),
        ('4:3', '2368x1760'),
        ('4:5', '1824x2272'),
        ('5:4', '2272x1824'),
        ('21:9', '3072x1376'),
        ('9:21', '1344x3136'),
    ],
)
def test_sensenova_u1_fast_uses_fixed_size_presets(ratio, expected):
    provider = _provider(model='sensenova-u1-fast')
    assert provider._resolve_size(ratio, '2K') == expected
    assert provider._resolve_size(ratio, '4K') == expected


def test_sensenova_u1_fast_unknown_ratio_falls_back_to_16x9():
    provider = _provider(model='sensenova-u1-fast')
    assert provider._resolve_size('7:9', '4K') == '2752x1536'


def test_sensenova_u1_fast_does_not_support_reference_edits():
    provider = _provider(model='sensenova-u1-fast')
    with pytest.raises(Exception, match='sensenova-u1\\.5-lite'):
        provider.generate_image(
            'make it blue',
            ref_images=[Image.new('RGB', (256, 256), color='red')],
        )


def test_sensenova_reference_extreme_aspect_is_padded():
    provider = _provider(model='sensenova-u1.5-lite')
    fitted = provider._fit_sensenova_reference_image(
        Image.new('RGB', (2000, 100), color='red')
    )
    width, height = fitted.size
    assert width <= 4096 and height <= 4096
    assert 256 <= min(width, height)
    assert round(max(width, height) / min(width, height), 4) <= 3.0001


def test_sensenova_reference_data_url_compresses_large_image():
    provider = _provider(model='sensenova-u1.5-lite')
    max_bytes = 1_000_000
    with patch.object(
        provider,
        '_sensenova_png_bytes',
        side_effect=[b'x' * (max_bytes + 1), b'ok'],
    ):
        data_url = provider._sensenova_reference_data_url(
            Image.new('RGB', (512, 512), color='red'),
            max_bytes=max_bytes,
        )
    assert data_url == 'data:image/png;base64,b2s='
