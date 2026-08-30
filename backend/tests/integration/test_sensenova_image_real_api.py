"""
Real API integration test for SenseNova U1.5 Lite image generation.

This test is intentionally skipped unless SENSENOVA_IMAGE_API_KEY is set; the
key is read only from the environment and is never stored in the repository.
"""

import os

import pytest
from PIL import Image

from services.ai_providers.image.openai_provider import OpenAIImageProvider


_API_KEY = os.getenv('SENSENOVA_IMAGE_API_KEY')


@pytest.mark.skipif(
    not _API_KEY,
    reason='Requires SENSENOVA_IMAGE_API_KEY for real SenseNova API testing',
)
class TestSenseNovaImageRealAPI:
    """Runs real SenseNova U1.5 Lite API calls against its native JSON API."""

    def test_text_to_image_generation(self):
        provider = OpenAIImageProvider(
            api_key=_API_KEY,
            api_base='https://token.sensenova.cn/v1',
            model='sensenova-u1.5-lite',
            image_api_protocol='auto',
        )

        generated = provider.generate_image(
            'a red apple on a white table',
            aspect_ratio='16:9',
            resolution='2K',
        )

        assert isinstance(generated, Image.Image)
        assert generated.width > 0 and generated.height > 0
        assert max(generated.size) <= 4096

    def test_reference_image_edit(self):
        provider = OpenAIImageProvider(
            api_key=_API_KEY,
            api_base='https://token.sensenova.cn/v1',
            model='sensenova-u1.5-lite',
            image_api_protocol='auto',
        )

        edited = provider.generate_image(
            'make the image blue',
            ref_images=[Image.new('RGB', (256, 256), color='red')],
            aspect_ratio='1:1',
            resolution='1K',
        )

        assert isinstance(edited, Image.Image)
        assert edited.width > 0 and edited.height > 0
        assert max(edited.size) <= 4096
