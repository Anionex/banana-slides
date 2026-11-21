"""Real API test for gpt-image-2.5 (Flare / Sunburst).

Run explicitly with RUN_REAL_GPT_IMAGE_25_TEST=1 plus an OpenAI-compatible
credential that actually serves the 2.5 model ids (APIMart does). The calls
generate real images and therefore incur API cost.
"""
import os

import pytest
from PIL import Image, ImageDraw

from services.ai_providers.image.openai_provider import OpenAIImageProvider


RUN_REAL_TEST = os.getenv('RUN_REAL_GPT_IMAGE_25_TEST') == '1'
API_KEY = os.getenv('GPT_IMAGE_25_TEST_API_KEY') or os.getenv('OPENAI_API_KEY')
API_BASE = os.getenv('GPT_IMAGE_25_TEST_API_BASE') or os.getenv('OPENAI_API_BASE')
FLARE = os.getenv('GPT_IMAGE_25_FLARE_MODEL', 'gpt-image-2.5-flare')
SUNBURST = os.getenv('GPT_IMAGE_25_SUNBURST_MODEL', 'gpt-image-2.5-sunburst')
OUTPUT_DIR = os.getenv('GPT_IMAGE_25_TEST_OUTPUT_DIR')


def _skip_reason() -> str:
    return 'Set RUN_REAL_GPT_IMAGE_25_TEST=1 and GPT_IMAGE_25_TEST_API_KEY to run'


def _provider(model: str, quality: str = 'auto') -> OpenAIImageProvider:
    return OpenAIImageProvider(
        api_key=API_KEY,
        api_base=API_BASE,
        model=model,
        image_api_protocol='auto',
        image_quality=quality,
    )


def _save(result: Image.Image, name: str) -> None:
    if OUTPUT_DIR:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        result.save(os.path.join(OUTPUT_DIR, name))


@pytest.mark.integration
@pytest.mark.skipif(not RUN_REAL_TEST or not API_KEY, reason=_skip_reason())
def test_flare_generates_2k_slide_background():
    """gpt-image-2.5-flare must route through the images API, not chat."""
    provider = _provider(FLARE)
    result = provider.generate_image(
        'A clean minimal presentation background: soft light-blue to white '
        'gradient, one thin diagonal accent line, no text, no logos.',
        aspect_ratio='16:9',
        resolution='2K',
    )

    assert isinstance(result, Image.Image)
    assert result.width >= 1024 and result.height >= 576
    _save(result, 'flare-16x9-2k.png')


@pytest.mark.integration
@pytest.mark.skipif(not RUN_REAL_TEST or not API_KEY, reason=_skip_reason())
def test_flare_accepts_max_quality_tier():
    """xhigh / max only exist on 2.5; verify the tier reaches the API."""
    provider = _provider(FLARE, quality='max')
    result = provider.generate_image(
        'A single glossy red sphere centered on a plain white background, '
        'studio lighting, sharp specular highlight.',
        aspect_ratio='1:1',
        resolution='1K',
    )

    assert isinstance(result, Image.Image)
    _save(result, 'flare-1x1-max.png')


@pytest.mark.integration
@pytest.mark.skipif(not RUN_REAL_TEST or not API_KEY, reason=_skip_reason())
def test_sunburst_edits_reference_image():
    """Sunburst is the editing-precision model: exercise the reference path."""
    reference = Image.new('RGB', (1024, 576), color='#f8fafc')
    draw = ImageDraw.Draw(reference)
    draw.rectangle((64, 64, 960, 512), outline='#2563eb', width=8)
    draw.ellipse((432, 208, 592, 368), fill='#f59e0b')

    provider = _provider(SUNBURST, quality='high')
    result = provider.generate_image(
        'Keep the blue border and the orange circle exactly where they are. '
        'Fill the rest of the frame with a soft gray-blue gradient.',
        ref_images=[reference],
        aspect_ratio='16:9',
        resolution='2K',
    )

    assert isinstance(result, Image.Image)
    _save(result, 'sunburst-edit-16x9.png')
