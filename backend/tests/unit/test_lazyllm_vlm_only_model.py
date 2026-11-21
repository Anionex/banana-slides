"""
Regression test for issue #326: LazyLLMTextProvider crashes when IMAGE_CAPTION_MODEL
is a VLM-only model (e.g. qwen-vl-max).

Root cause: lazyllm raises AssertionError when type='llm' is passed explicitly for
a VLM model. Fix: omit type so lazyllm auto-detects LLM vs VLM; read _type back
to set _is_vlm_only.
"""
import pytest
from unittest.mock import MagicMock, patch
from enum import Enum


class _LLMType(str, Enum):
    LLM = 'LLM'
    VLM = 'VLM'


def _make_client(model: str, vlm_models: set) -> MagicMock:
    """Return a mock OnlineModule client with the correct _type."""
    client = MagicMock(return_value='result text')
    client._type = _LLMType.VLM if model in vlm_models else _LLMType.LLM
    client._model_name = model
    return client


def _make_lazyllm_mock(vlm_models=None):
    """Build a mock lazyllm module that auto-detects LLM vs VLM."""
    if vlm_models is None:
        vlm_models = {'qwen-vl-max'}

    mock_lazyllm = MagicMock()
    mock_namespace = MagicMock()
    mock_lazyllm.namespace.return_value = mock_namespace

    def online_module_factory(source, model, type=None, **kwargs):
        if type is not None and type == 'llm' and model in vlm_models:
            raise AssertionError(f"model_name {model} is a VLM model, but type is LLM")
        return _make_client(model, vlm_models)

    mock_namespace.OnlineModule.side_effect = online_module_factory
    return mock_lazyllm


class TestLazyLLMVLMOnlyModel:
    """Tests for VLM-only model auto-detection in LazyLLMTextProvider."""

    @pytest.fixture
    def patch_env(self):
        with patch('services.ai_providers.text.lazyllm_provider.ensure_lazyllm_namespace_key'):
            yield

    def test_llm_model_initializes_with_llm_type(self, patch_env):
        """Normal LLM model (qwen-max) is detected as non-VLM."""
        mock_lazyllm = _make_lazyllm_mock()
        with patch.dict('sys.modules', {'lazyllm': mock_lazyllm}):
            from services.ai_providers.text.lazyllm_provider import LazyLLMTextProvider
            provider = LazyLLMTextProvider(source='qwen', model='qwen-max')

        assert provider._is_vlm_only is False

    def test_vlm_model_detected_as_vlm_only(self, patch_env):
        """VLM-only model (qwen-vl-max) is auto-detected without AssertionError."""
        mock_lazyllm = _make_lazyllm_mock(vlm_models={'qwen-vl-max'})
        with patch.dict('sys.modules', {'lazyllm': mock_lazyllm}):
            from services.ai_providers.text.lazyllm_provider import LazyLLMTextProvider
            provider = LazyLLMTextProvider(source='qwen', model='qwen-vl-max')

        assert provider._is_vlm_only is True

    def test_vlm_only_generate_with_image_reuses_client(self, patch_env):
        """generate_with_image on a VLM-only model reuses self.client."""
        mock_lazyllm = _make_lazyllm_mock(vlm_models={'qwen-vl-max'})
        with patch.dict('sys.modules', {'lazyllm': mock_lazyllm}):
            from services.ai_providers.text.lazyllm_provider import LazyLLMTextProvider
            provider = LazyLLMTextProvider(source='qwen', model='qwen-vl-max')
            init_client = provider.client
            provider.generate_with_image('describe this', '/tmp/fake.png')

        assert provider._vlm_client is None, "_vlm_client should stay None for VLM-only models"
        assert provider.client is init_client, "client should not be replaced"

    def test_normal_model_generate_with_image_creates_vlm_client(self, patch_env):
        """generate_with_image on a normal LLM model lazily creates _vlm_client."""
        mock_lazyllm = _make_lazyllm_mock(vlm_models={'qwen-vl-max'})
        with patch.dict('sys.modules', {'lazyllm': mock_lazyllm}):
            from services.ai_providers.text.lazyllm_provider import LazyLLMTextProvider
            provider = LazyLLMTextProvider(source='qwen', model='qwen-max')

            assert provider._is_vlm_only is False
            assert provider._vlm_client is None

            provider.generate_with_image('describe this', '/tmp/fake.png')

        assert provider._vlm_client is not None

    def test_ai_service_init_succeeds_with_vlm_caption_model(self, patch_env):
        """
        Regression for issue #326: both caption (qwen-vl-max) and text (qwen-max)
        providers initialize without error when using lazyllm.
        """
        mock_lazyllm = _make_lazyllm_mock(vlm_models={'qwen-vl-max'})
        with patch.dict('sys.modules', {'lazyllm': mock_lazyllm}):
            from services.ai_providers.text.lazyllm_provider import LazyLLMTextProvider
            caption_provider = LazyLLMTextProvider(source='qwen', model='qwen-vl-max')
            text_provider = LazyLLMTextProvider(source='qwen', model='qwen-max')

        assert caption_provider._is_vlm_only is True
        assert text_provider._is_vlm_only is False
