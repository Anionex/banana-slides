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


def test_generate_single_caption_openai_uses_configured_model():
    """OpenAI caption generation should use `image_caption_model` from service config."""
    image_path = _create_temp_image()
    try:
        service = FileParserService(
            mineru_token='test-token',
            openai_api_key='test-openai-key',
            image_caption_model='gpt-4.1-mini',
            provider_format='openai',
        )

        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content='示例描述'))]
        mock_client.chat.completions.create.return_value = mock_response

        with patch('utils.path_utils.find_mineru_file_with_prefix', return_value=Path(image_path)):
            with patch.object(service, '_get_openai_client', return_value=mock_client):
                caption = service._generate_single_caption('/files/mineru/demo.png')

        assert caption == '示例描述'
        assert mock_client.chat.completions.create.call_args.kwargs['model'] == 'gpt-4.1-mini'
    finally:
        if os.path.exists(image_path):
            os.remove(image_path)


def test_can_generate_captions_does_not_accept_legacy_prefixes():
    """LazyLLM caption check should ignore legacy BANANA_*/LAZYLLM_* key prefixes."""
    source = 'unit_test_source'
    with patch.dict(
        os.environ,
        {
            f'BANANA_{source.upper()}_API_KEY': 'test-key',
            f'LAZYLLM_{source.upper()}_API_KEY': 'test-key',
            f'BANANA_SLIDES_{source.upper()}_API_KEY': 'test-key',
        },
        clear=False,
    ):
        service = FileParserService(
            mineru_token='test-token',
            provider_format='lazyllm',
            lazyllm_image_caption_source=source,
        )
        assert service._can_generate_captions() is False


def test_can_generate_captions_accepts_vendor_prefix_key():
    """LazyLLM caption check should accept {SOURCE}_API_KEY vendor prefix."""
    source = 'qwen'
    key_name = f'{source.upper()}_API_KEY'

    with patch.dict(os.environ, {key_name: 'test-key'}, clear=False):
        service = FileParserService(
            mineru_token='test-token',
            provider_format='lazyllm',
            lazyllm_image_caption_source=source,
        )
        assert service._can_generate_captions() is True
