"""Test that image generation prompt uses the correct aspect ratio."""
from services.prompts import get_image_generation_prompt


class TestImagePromptAspectRatio:
    def test_default_ratio_is_16_9(self):
        prompt = get_image_generation_prompt(
            page_desc="Test page",
            outline_text="Test outline",
            current_section="Section 1",
        )
        assert "16:9比例" in prompt

    def test_custom_ratio_4_3(self):
        prompt = get_image_generation_prompt(
            page_desc="Test page",
            outline_text="Test outline",
            current_section="Section 1",
            aspect_ratio="4:3",
        )
        assert "4:3比例" in prompt
        assert "16:9比例" not in prompt

    def test_custom_ratio_1_1(self):
        prompt = get_image_generation_prompt(
            page_desc="Test page",
            outline_text="Test outline",
            current_section="Section 1",
            aspect_ratio="1:1",
        )
        assert "1:1比例" in prompt
        assert "16:9比例" not in prompt
