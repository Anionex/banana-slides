"""
Unit tests for LazyLLM image provider content-type fallback.

Verifies that when LazyLLM raises a content-type error (S3 returns
application/octet-stream), the provider falls back to manual download.
"""
import io
import sys
import types
import pytest
from unittest.mock import MagicMock, patch
from PIL import Image


def _make_png_bytes() -> bytes:
    img = Image.new('RGB', (100, 60), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def _inject_lazyllm_mock():
    """Inject a fake lazyllm into sys.modules so the provider can be imported."""
    lz = types.ModuleType('lazyllm')
    lz.namespace = MagicMock(return_value=MagicMock())

    components = types.ModuleType('lazyllm.components')
    formatter = types.ModuleType('lazyllm.components.formatter')
    formatter.decode_query_with_filepaths = MagicMock(return_value={'files': []})

    sys.modules.setdefault('lazyllm', lz)
    sys.modules.setdefault('lazyllm.components', components)
    sys.modules.setdefault('lazyllm.components.formatter', formatter)
    return lz, formatter


class TestLazyLLMContentTypeFallback:

    def setup_method(self):
        self._lz, self._formatter = _inject_lazyllm_mock()
        # Remove cached provider module so it re-imports with our mock
        for key in ('services.ai_providers.image.lazyllm_provider',
                    'backend.services.ai_providers.image.lazyllm_provider'):
            sys.modules.pop(key, None)

    def _make_provider(self):
        with patch('services.ai_providers.image.lazyllm_provider.ensure_lazyllm_namespace_key'):
            from services.ai_providers.image.lazyllm_provider import LazyLLMImageProvider
            provider = LazyLLMImageProvider.__new__(LazyLLMImageProvider)
            provider._source = 'siliconflow'
            provider.client = MagicMock()
            return provider

    def test_fallback_on_content_type_error(self):
        """Provider downloads image manually when LazyLLM raises content-type error."""
        provider = self._make_provider()

        s3_url = 'https://s3.siliconflow.cn/outputs/test.png?X-Amz-Signature=abc'
        error_msg = (
            f'ModuleExecutionError: Failed to load image from {s3_url}\n'
            f'Invalid content type for image: application/octet-stream from {s3_url}\n'
            'Expected content type starting with "image/".'
        )
        provider.client.side_effect = Exception(error_msg)

        png_bytes = _make_png_bytes()
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.iter_content = MagicMock(return_value=iter([png_bytes]))

        with patch('services.ai_providers.image.lazyllm_provider.requests.get',
                   return_value=mock_resp) as mock_get:
            result = provider.generate_image(prompt='test prompt')

        assert result is not None
        assert isinstance(result, Image.Image)
        mock_get.assert_called_once()
        assert 's3.siliconflow.cn' in mock_get.call_args[0][0]

    def test_untrusted_host_is_not_fetched(self):
        """URLs from untrusted hosts should not be fetched (SSRF prevention)."""
        provider = self._make_provider()

        evil_url = 'https://evil.example.com/steal.png'
        error_msg = (
            f'Failed to load image from {evil_url}\n'
            'Invalid content type for image: application/octet-stream'
        )
        provider.client.side_effect = Exception(error_msg)

        with patch('services.ai_providers.image.lazyllm_provider.requests.get') as mock_get:
            with pytest.raises(Exception):
                provider.generate_image(prompt='test prompt')
        mock_get.assert_not_called()

    def test_non_content_type_error_is_reraised(self):
        """Non content-type errors propagate normally."""
        provider = self._make_provider()
        provider.client.side_effect = RuntimeError('network timeout')

        with pytest.raises(RuntimeError, match='network timeout'):
            provider.generate_image(prompt='test prompt')
