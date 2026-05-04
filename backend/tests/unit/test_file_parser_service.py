"""
Unit tests for FileParserService provider-specific behavior.
"""

import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from PIL import Image

from services.file_parser_service import FileParserService


def _create_temp_image() -> str:
    with tempfile.NamedTemporaryFile(prefix='caption_test_', suffix='.png', delete=False) as tmp:
        Image.new('RGB', (20, 20), color='green').save(tmp.name)
        return tmp.name


def test_generate_single_caption_uses_provider_factory():
    """Caption generation should delegate to the provider factory's generate_with_image."""
    image_path = _create_temp_image()
    try:
        service = FileParserService(
            mineru_token='test-token',
            image_caption_model='gpt-4.1-mini',
            provider_format='openai',
        )

        mock_provider = MagicMock()
        mock_provider.generate_with_image.return_value = '示例描述'

        with patch('utils.path_utils.find_mineru_file_with_prefix', return_value=Path(image_path)):
            with patch.object(service, '_get_caption_provider', return_value=mock_provider):
                caption = service._generate_single_caption('/files/mineru/demo.png')

        assert caption == '示例描述'
        mock_provider.generate_with_image.assert_called_once()
        call_args = mock_provider.generate_with_image.call_args
        assert '描述' in call_args[0][0]
    finally:
        if os.path.exists(image_path):
            os.remove(image_path)


def test_can_generate_captions_returns_false_when_factory_fails():
    """_can_generate_captions should return False when the provider factory raises."""
    service = FileParserService(
        mineru_token='test-token',
        provider_format='lazyllm',
    )
    with patch(
        'services.file_parser_service.FileParserService._get_caption_provider',
        side_effect=ValueError("no key"),
    ):
        assert service._can_generate_captions() is False


def test_can_generate_captions_returns_true_when_factory_succeeds():
    """_can_generate_captions should return True when the provider factory returns a provider."""
    service = FileParserService(
        mineru_token='test-token',
        provider_format='openai',
    )
    mock_provider = MagicMock()
    with patch.object(service, '_get_caption_provider', return_value=mock_provider):
        assert service._can_generate_captions() is True


def test_generate_single_caption_vertex_uses_provider_factory():
    """Vertex provider should also go through the factory (the original bug)."""
    image_path = _create_temp_image()
    try:
        service = FileParserService(
            mineru_token='test-token',
            image_caption_model='gemini-2.0-flash',
            provider_format='vertex',
        )

        mock_provider = MagicMock()
        mock_provider.generate_with_image.return_value = '顶点描述'

        with patch('utils.path_utils.find_mineru_file_with_prefix', return_value=Path(image_path)):
            with patch.object(service, '_get_caption_provider', return_value=mock_provider):
                caption = service._generate_single_caption('/files/mineru/demo.png')

        assert caption == '顶点描述'
        mock_provider.generate_with_image.assert_called_once()
    finally:
        if os.path.exists(image_path):
            os.remove(image_path)
