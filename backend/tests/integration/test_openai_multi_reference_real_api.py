"""Real API regression test for multiple GPT Image references.

Run explicitly with RUN_REAL_OPENAI_IMAGE_TEST=1 and valid OpenAI-compatible
credentials. The call generates one 1K image and therefore incurs API cost.
"""

import os

import pytest
from PIL import Image, ImageDraw

from services.ai_providers.image.openai_provider import OpenAIImageProvider


RUN_REAL_TEST = os.getenv('RUN_REAL_OPENAI_IMAGE_TEST') == '1'
API_KEY = os.getenv('OPENAI_API_KEY')


@pytest.mark.integration
@pytest.mark.skipif(
    not RUN_REAL_TEST or not API_KEY,
    reason='Set RUN_REAL_OPENAI_IMAGE_TEST=1 and OPENAI_API_KEY to run',
)
def test_gpt_image_accepts_template_and_material_references():
    provider = OpenAIImageProvider(
        api_key=API_KEY,
        api_base=os.getenv('OPENAI_API_BASE') or None,
        model=os.getenv('OPENAI_MULTI_REFERENCE_TEST_MODEL', 'gpt-image-2'),
        image_api_protocol='images',
    )

    template = Image.new('RGB', (512, 512), color='#f5efe6')
    template_draw = ImageDraw.Draw(template)
    template_draw.rectangle((40, 40, 472, 472), outline='#7c3aed', width=18)

    material = Image.new('RGB', (512, 512), color='white')
    material_draw = ImageDraw.Draw(material)
    material_draw.ellipse((96, 96, 416, 416), fill='#0ea5e9')
    material_draw.rectangle((216, 216, 296, 296), fill='#facc15')

    result = provider.generate_image(
        prompt=(
            'Create a clean square presentation cover. Use the first image for '
            'the border style and include the blue circle with yellow square from '
            'the second image as the main visual.'
        ),
        ref_images=[template, material],
        aspect_ratio='1:1',
        resolution='1K',
    )

    assert isinstance(result, Image.Image)
    assert result.width > 0 and result.height > 0

    output_path = os.getenv('OPENAI_MULTI_REFERENCE_TEST_OUTPUT')
    if output_path:
        result.save(output_path)
