"""Size-resolution tests for Volcengine Seedream via the OpenAI images API.

Seedream 5.0-lite / 4.5 reject explicit sizes below 2560x1440 (3,686,400 px),
so the generic GPT sizing (2048x1152 for 16:9 / 2K) must not be sent verbatim.
These tests pin the documented Volcengine presets and the scaling fallback.
"""

import base64
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from services.ai_providers.image.openai_provider import (
    OpenAIImageProvider,
    _DOUBAO_SEEDREAM_MAX_PIXELS,
    _DOUBAO_SEEDREAM_MIN_PIXELS,
    _DOUBAO_SEEDREAM_SIZE_PRESETS,
    _compute_gpt_image_size,
    _scale_size_to_pixel_range,
)


def _make_b64_png() -> str:
    image = Image.new('RGB', (16, 16), color='white')
    buffer = BytesIO()
    image.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()


def _make_provider(model: str = 'doubao-seedream-5.0-lite') -> OpenAIImageProvider:
    client = MagicMock()
    with patch('services.ai_providers.image.openai_provider.OpenAI'):
        provider = OpenAIImageProvider(
            api_key='test',
            api_base='http://test',
            model=model,
            image_api_protocol='auto',
        )
    raw_response = MagicMock()
    raw_response.json.return_value = {'data': [{'b64_json': _make_b64_png()}]}
    client.images.with_raw_response.generate.return_value = raw_response
    provider.client = client
    return provider


def _size_pixels(size: str) -> int:
    w, h = (int(part) for part in size.split('x'))
    return w * h


def _size_ratio(size: str) -> float:
    w, h = (int(part) for part in size.split('x'))
    return w / h


@pytest.mark.parametrize(
    'tier,ratio,expected',
    [
        ('2K', '1:1', '2048x2048'),
        ('2K', '4:3', '2304x1728'),
        ('2K', '3:4', '1728x2304'),
        ('2K', '16:9', '2848x1600'),
        ('2K', '9:16', '1600x2848'),
        ('2K', '3:2', '2496x1664'),
        ('2K', '2:3', '1664x2496'),
        ('2K', '21:9', '3136x1344'),
        ('3K', '1:1', '3072x3072'),
        ('3K', '16:9', '4096x2304'),
        ('4K', '16:9', '5504x3040'),
        ('4K', '21:9', '6240x2656'),
    ],
)
def test_seedream_lite_uses_official_presets(tier, ratio, expected):
    provider = _make_provider()
    assert provider._resolve_size(ratio, tier) == expected


@pytest.mark.parametrize('tier', ['2K', '3K', '4K'])
def test_seedream_lite_all_official_presets_within_pixel_range(tier):
    provider = _make_provider()
    for ratio, size in _DOUBAO_SEEDREAM_SIZE_PRESETS[tier].items():
        resolved = provider._resolve_size(ratio, tier)
        pixels = _size_pixels(resolved)
        assert _DOUBAO_SEEDREAM_MIN_PIXELS <= pixels <= _DOUBAO_SEEDREAM_MAX_PIXELS, (
            f'{tier}/{ratio} -> {resolved} ({pixels} px) outside documented range'
        )
        assert 1 / 16 <= _size_ratio(resolved) <= 16


def test_seedream_lite_default_16x9_2k_meets_minimum_pixels():
    """Regression for the P1: the previous GPT sizing produced 2048x1152 (2.36M px)."""
    provider = _make_provider()
    resolved = provider._resolve_size('16:9', '2K')
    assert resolved == '2848x1600'
    assert _size_pixels(resolved) >= _DOUBAO_SEEDREAM_MIN_PIXELS


def test_seedream_lite_1k_falls_back_to_2k_presets():
    provider = _make_provider()
    # 1K is below Seedream's smallest tier; resolve to the documented 2K preset.
    assert provider._resolve_size('16:9', '1K') == '2848x1600'


def test_seedream_lite_unlisted_ratio_scaled_to_minimum_pixels():
    provider = _make_provider()
    resolved = provider._resolve_size('5:4', '2K')
    w, h = (int(part) for part in resolved.split('x'))
    assert _size_pixels(resolved) >= _DOUBAO_SEEDREAM_MIN_PIXELS
    assert _size_pixels(resolved) <= _DOUBAO_SEEDREAM_MAX_PIXELS
    assert w % 16 == 0 and h % 16 == 0
    # Aspect ratio preserved (5:4 = 1.25), within the tolerance of edge rounding.
    assert abs(w / h - 5 / 4) < 0.02


def test_seedream_lite_extreme_ratio_stays_within_aspect_range():
    provider = _make_provider()
    resolved = provider._resolve_size('8:1', '2K')
    assert _DOUBAO_SEEDREAM_MIN_PIXELS <= _size_pixels(resolved) <= _DOUBAO_SEEDREAM_MAX_PIXELS
    assert 1 / 16 <= _size_ratio(resolved) <= 16


def test_seedream_pro_4k_request_capped_to_2k_tier():
    provider = _make_provider(model='doubao-seedream-5.0-pro')
    resolved = provider._resolve_size('16:9', '4K')
    # 5.0-pro accepts at most 4,624,220 px and has no 4K tier.
    assert 921_600 <= _size_pixels(resolved) <= 4_624_220
    assert resolved == '2848x1600'


def test_seedream_40_1k_stays_within_its_larger_range():
    provider = _make_provider(model='doubao-seedream-4.0')
    resolved = provider._resolve_size('16:9', '1K')
    # 4.0 allows 921,600 px minimum; the 2K preset remains valid for it.
    assert 921_600 <= _size_pixels(resolved) <= _DOUBAO_SEEDREAM_MAX_PIXELS
    assert resolved == '2848x1600'


def test_non_seedream_models_keep_gpt_sizing():
    """Regression guard: only Seedream models switch to the preset tables."""
    provider = _make_provider(model='gpt-image-1')
    assert provider._resolve_size('16:9', '2K') == '2048x1152'
    assert _compute_gpt_image_size('16:9', '2K') == '2048x1152'


def test_generate_image_sends_seedream_valid_size():
    provider = _make_provider()
    provider.generate_image(
        prompt='A slide background',
        aspect_ratio='16:9',
        resolution='2K',
    )
    request = provider.client.images.with_raw_response.generate.call_args.kwargs
    assert request['size'] == '2848x1600'


def test_scale_helper_enlarges_with_ceil_rounding():
    assert _scale_size_to_pixel_range(
        '2048x1152', _DOUBAO_SEEDREAM_MIN_PIXELS, _DOUBAO_SEEDREAM_MAX_PIXELS
    ) == '2560x1440'


def test_scale_helper_shrinks_with_floor_rounding():
    assert _scale_size_to_pixel_range('4096x4096', 921_600, 4_624_220) == '2144x2144'


def test_scale_helper_returns_auto_for_invalid_input():
    assert _scale_size_to_pixel_range('auto', 1, 2) == 'auto'
    assert _scale_size_to_pixel_range('0x1024', 1, 2) == 'auto'
    assert _scale_size_to_pixel_range(None, 1, 2) == 'auto'
