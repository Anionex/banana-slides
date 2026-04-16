import io
from types import SimpleNamespace
from unittest.mock import MagicMock

from PIL import Image

from services.ai_providers.image.genai_provider import GenAIImageProvider


def _make_png_bytes() -> bytes:
    image = Image.new("RGB", (96, 54), color=(12, 140, 220))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


class _InlineDataPart:
    def __init__(self, data: bytes):
        self.inline_data = SimpleNamespace(data=data)
        self.text = None


class TestGenAIImageProvider:
    def _make_provider(self, response):
        provider = GenAIImageProvider.__new__(GenAIImageProvider)
        provider.model = "test-model"
        provider.client = MagicMock()
        provider.client.models.generate_content.return_value = response
        return provider

    def test_extracts_image_from_inline_data_part(self):
        response = SimpleNamespace(
            parts=[_InlineDataPart(_make_png_bytes())],
            candidates=[],
            text=None,
        )
        provider = self._make_provider(response)

        result = provider.generate_image(prompt="test prompt", enable_thinking=False)

        assert isinstance(result, Image.Image)
        assert result.size == (96, 54)

    def test_extracts_image_from_candidate_nested_parts(self):
        candidate_part = {"inline_data": {"data": _make_png_bytes()}}
        response = SimpleNamespace(
            parts=[],
            candidates=[
                SimpleNamespace(
                    content=SimpleNamespace(parts=[candidate_part]),
                    finish_reason="STOP",
                )
            ],
            text=None,
        )
        provider = self._make_provider(response)

        result = provider.generate_image(prompt="test prompt", enable_thinking=False)

        assert isinstance(result, Image.Image)
        assert result.size == (96, 54)
