"""
Tests for defensive parsing of proxy image API responses.

Verifies that _extract_from_images_result and _decode_image_response
handle non-standard responses from proxies like newapi/one-api.
"""

import base64
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

import pytest
from PIL import Image

from services.ai_providers.image.openai_provider import OpenAIImageProvider


def _make_provider() -> OpenAIImageProvider:
    with patch('services.ai_providers.image.openai_provider.OpenAI'):
        return OpenAIImageProvider(api_key='test', api_base='http://test', model='gpt-image-2')


def _make_b64_png() -> str:
    """Create a minimal valid PNG as base64."""
    img = Image.new('RGB', (16, 16), color='red')
    buf = BytesIO()
    img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode()


def _mock_requests_get(png_bytes):
    """Create a mock for requests.get that works as a context manager."""
    mock_resp = MagicMock()
    mock_resp.content = png_bytes
    mock_resp.raise_for_status = MagicMock()
    mock_resp.__enter__ = MagicMock(return_value=mock_resp)
    mock_resp.__exit__ = MagicMock(return_value=False)
    return patch('services.ai_providers.image.openai_provider.requests.get', return_value=mock_resp)


class TestDecodeImageResponse:
    """Test _decode_image_response with various item types."""

    def test_standard_object_b64(self):
        provider = _make_provider()
        item = SimpleNamespace(b64_json=_make_b64_png(), url=None)
        result = provider._decode_image_response(item)
        assert isinstance(result, Image.Image)

    def test_standard_object_url(self):
        provider = _make_provider()
        b64 = _make_b64_png()
        png_bytes = base64.b64decode(b64)
        item = SimpleNamespace(b64_json=None, url='http://example.com/img.png')
        with _mock_requests_get(png_bytes):
            result = provider._decode_image_response(item)
        assert isinstance(result, Image.Image)

    def test_dict_b64(self):
        provider = _make_provider()
        item = {'b64_json': _make_b64_png(), 'url': None}
        result = provider._decode_image_response(item)
        assert isinstance(result, Image.Image)

    def test_dict_url(self):
        provider = _make_provider()
        b64 = _make_b64_png()
        png_bytes = base64.b64decode(b64)
        item = {'b64_json': None, 'url': 'http://example.com/img.png'}
        with _mock_requests_get(png_bytes):
            result = provider._decode_image_response(item)
        assert isinstance(result, Image.Image)

    def test_raw_base64_string(self):
        provider = _make_provider()
        result = provider._decode_image_response(_make_b64_png())
        assert isinstance(result, Image.Image)

    def test_data_url_string(self):
        provider = _make_provider()
        data_url = f'data:image/png;base64,{_make_b64_png()}'
        result = provider._decode_image_response(data_url)
        assert isinstance(result, Image.Image)


class TestExtractFromImagesResult:
    """Test _extract_from_images_result with various result shapes."""

    def test_standard_images_response(self):
        provider = _make_provider()
        item = SimpleNamespace(b64_json=_make_b64_png(), url=None)
        result_obj = SimpleNamespace(data=[item])
        img = provider._extract_from_images_result(result_obj)
        assert isinstance(img, Image.Image)

    def test_result_is_raw_string_base64(self):
        provider = _make_provider()
        img = provider._extract_from_images_result(_make_b64_png())
        assert isinstance(img, Image.Image)

    def test_result_is_raw_string_url(self):
        provider = _make_provider()
        b64 = _make_b64_png()
        png_bytes = base64.b64decode(b64)
        with _mock_requests_get(png_bytes):
            img = provider._extract_from_images_result('http://example.com/img.png')
        assert isinstance(img, Image.Image)

    def test_result_is_dict_with_data_list(self):
        provider = _make_provider()
        result_dict = {'data': [{'b64_json': _make_b64_png(), 'url': None}]}
        img = provider._extract_from_images_result(result_dict)
        assert isinstance(img, Image.Image)

    def test_result_is_flat_dict_b64(self):
        provider = _make_provider()
        result_dict = {'b64_json': _make_b64_png()}
        img = provider._extract_from_images_result(result_dict)
        assert isinstance(img, Image.Image)

    def test_result_is_flat_dict_url(self):
        provider = _make_provider()
        b64 = _make_b64_png()
        png_bytes = base64.b64decode(b64)
        result_dict = {'url': 'http://example.com/img.png'}
        with _mock_requests_get(png_bytes):
            img = provider._extract_from_images_result(result_dict)
        assert isinstance(img, Image.Image)

    def test_result_data_is_empty_list_falls_through(self):
        """When result.data is an empty list, should raise."""
        provider = _make_provider()
        result_obj = SimpleNamespace(data=[])
        with pytest.raises(ValueError, match="Unexpected images API response type"):
            provider._extract_from_images_result(result_obj)

    def test_unsupported_type_raises(self):
        provider = _make_provider()
        with pytest.raises(ValueError, match="Unexpected images API response type"):
            provider._extract_from_images_result(12345)
