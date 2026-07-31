"""
Real API integration tests for LazyLLM vendor registration and providers.

These tests make REAL API calls to verify every LazyLLM vendor registered by
``ensure_lazyllm_suppliers`` actually resolves and that the provider chain
works end to end.  They are skipped unless the matching ``{VENDOR}_API_KEY``
environment variable is set.

Cost: < $0.01 per call for short text prompts.
"""
import os

import pytest

try:
    import lazyllm
    LAZYLLM_AVAILABLE = True
except ImportError:
    LAZYLLM_AVAILABLE = False


@pytest.mark.skipif(
    not LAZYLLM_AVAILABLE,
    reason="Requires lazyllm installed for real API testing",
)
class TestLazyLLMRealVendors:
    """Real API tests against the official vendor endpoints."""

    @pytest.mark.integration
    @pytest.mark.skipif(
        not os.getenv('DEEPSEEK_API_KEY'),
        reason="Requires DEEPSEEK_API_KEY for real API testing",
    )
    def test_deepseek_text_generation(self):
        from services.ai_providers.text.lazyllm_provider import LazyLLMTextProvider

        provider = LazyLLMTextProvider(source='deepseek', model='deepseek-chat')
        out = provider.generate_text('只回复两个字：你好')
        assert out and out.strip(), 'DeepSeek returned an empty response'

    @pytest.mark.integration
    @pytest.mark.skipif(
        not os.getenv('GLM_API_KEY'),
        reason="Requires GLM_API_KEY for real API testing",
    )
    def test_glm_text_generation(self):
        from services.ai_providers.text.lazyllm_provider import LazyLLMTextProvider

        provider = LazyLLMTextProvider(source='glm', model='glm-4-plus')
        out = provider.generate_text('只回复两个字：你好')
        assert out and out.strip(), 'GLM returned an empty response'

    @pytest.mark.integration
    @pytest.mark.skipif(
        not os.getenv('QWEN_API_KEY'),
        reason="Requires QWEN_API_KEY for real API testing",
    )
    def test_qwen_vlm_caption(self):
        """Image captioning through the qwen chat registry (issue #539 path)."""
        from PIL import Image
        from services.ai_providers.text.lazyllm_provider import LazyLLMTextProvider

        import tempfile
        img = Image.new('RGB', (640, 480), (30, 120, 200))
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            path = tmp.name
        img.save(path)
        try:
            provider = LazyLLMTextProvider(source='qwen', model='qwen3-vl-flash')
            out = provider.generate_with_image('用一句话描述这张图片', path)
            assert out and out.strip(), 'Qwen VLM returned an empty response'
        finally:
            os.remove(path)
