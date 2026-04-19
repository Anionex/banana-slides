"""
Regression test for issue #326: LazyLLMTextProvider crashes when IMAGE_CAPTION_MODEL
is a VLM-only model (e.g. qwen-vl-max).

Root cause: lazyllm raises AssertionError when type='llm' is used with a VLM model.
Fix: fall back to type='vlm' on AssertionError, set _is_vlm_only=True.
"""
import pytest
from unittest.mock import MagicMock, patch, call


def _make_lazyllm_mock(vlm_models=None):
    """
    Build a mock lazyllm module.

    vlm_models: set of model names that trigger AssertionError on type='llm'.
                Defaults to {'qwen-vl-max'}.
    """
    if vlm_models is None:
        vlm_models = {'qwen-vl-max'}

    mock_lazyllm = MagicMock()
    mock_namespace = MagicMock()
    mock_lazyllm.namespace.return_value = mock_namespace

    def online_module_factory(source, model, type, **kwargs):
        if type == 'llm' and model in vlm_models:
            raise AssertionError(
                f"model_name {model} is a VLM model, but type is LLM"
            )
        client = MagicMock()
        client._model_name = model
        client._type = type
        return client

    mock_namespace.OnlineModule.side_effect = online_module_factory
    return mock_lazyllm


class TestLazyLLMVLMOnlyModel:
    """Tests for VLM-only model fallback in LazyLLMTextProvider."""

    @pytest.fixture
    def patch_env(self):
        with patch('services.ai_providers.text.lazyllm_provider.ensure_lazyllm_namespace_key'):
            yield

    def test_llm_model_initializes_normally(self, patch_env):
        """Normal LLM model (e.g. qwen-max) should create type='llm' client."""
        mock_lazyllm = _make_lazyllm_mock()
        with patch.dict('sys.modules', {'lazyllm': mock_lazyllm}):
            from services.ai_providers.text.lazyllm_provider import LazyLLMTextProvider
            provider = LazyLLMTextProvider(source='qwen', model='qwen-max')

        assert provider._is_vlm_only is False
        # OnlineModule called once with type='llm'
        calls = mock_lazyllm.namespace().OnlineModule.call_args_list
        assert any(c.kwargs.get('type') == 'llm' and c.kwargs.get('model') == 'qwen-max'
                   for c in calls)

    def test_vlm_model_falls_back_to_vlm_type(self, patch_env):
        """VLM-only model (e.g. qwen-vl-max) must fall back to type='vlm' without crashing."""
        mock_lazyllm = _make_lazyllm_mock(vlm_models={'qwen-vl-max'})
        with patch.dict('sys.modules', {'lazyllm': mock_lazyllm}):
            from services.ai_providers.text.lazyllm_provider import LazyLLMTextProvider
            # Should not raise
            provider = LazyLLMTextProvider(source='qwen', model='qwen-vl-max')

        assert provider._is_vlm_only is True
        # Final successful call must be type='vlm'
        calls = mock_lazyllm.namespace().OnlineModule.call_args_list
        vlm_calls = [c for c in calls if c.kwargs.get('type') == 'vlm'
                     and c.kwargs.get('model') == 'qwen-vl-max']
        assert len(vlm_calls) >= 1, "Expected at least one type='vlm' OnlineModule call"

    def test_vlm_only_generate_with_image_reuses_client(self, patch_env):
        """generate_with_image on a VLM-only model should reuse self.client."""
        mock_lazyllm = _make_lazyllm_mock(vlm_models={'qwen-vl-max'})
        # Make the VLM client callable and return a plain string
        mock_vlm_client = MagicMock(return_value='caption result')
        mock_lazyllm.namespace().OnlineModule.side_effect = None
        mock_lazyllm.namespace().OnlineModule.return_value = mock_vlm_client

        with patch.dict('sys.modules', {'lazyllm': mock_lazyllm}):
            from services.ai_providers.text.lazyllm_provider import LazyLLMTextProvider
            provider = LazyLLMTextProvider(source='qwen', model='qwen-vl-max')
            # Force is_vlm_only manually since mock doesn't raise AssertionError
            provider._is_vlm_only = True
            init_client = provider.client
            result = provider.generate_with_image('describe this', '/tmp/fake.png')

        # No new OnlineModule should have been created after __init__
        assert provider._vlm_client is None, "_vlm_client should stay None for VLM-only models"
        assert provider.client is init_client, "client should not be replaced"

    def test_normal_model_generate_with_image_creates_vlm_client(self, patch_env):
        """generate_with_image on a normal LLM model should lazily create _vlm_client."""
        mock_lazyllm = _make_lazyllm_mock(vlm_models={'qwen-vl-max'})
        mock_vlm_client = MagicMock(return_value='image description')

        def online_module_factory(source, model, type, **kwargs):
            # LLM models get a generic mock; VLM call returns our tracked mock
            if type == 'vlm':
                return mock_vlm_client
            return MagicMock(return_value='text result')

        mock_lazyllm.namespace().OnlineModule.side_effect = online_module_factory

        with patch.dict('sys.modules', {'lazyllm': mock_lazyllm}):
            from services.ai_providers.text.lazyllm_provider import LazyLLMTextProvider
            provider = LazyLLMTextProvider(source='qwen', model='qwen-max')

            assert provider._is_vlm_only is False
            assert provider._vlm_client is None

            provider.generate_with_image('describe this', '/tmp/fake.png')

        assert provider._vlm_client is not None, "_vlm_client should be created on first call"

    def test_ai_service_init_succeeds_with_vlm_caption_model(self, patch_env):
        """
        Regression: AIService.__init__ must not crash when IMAGE_CAPTION_MODEL=qwen-vl-max
        (the original bug from issue #326).
        """
        mock_lazyllm = _make_lazyllm_mock(vlm_models={'qwen-vl-max'})

        with patch.dict('sys.modules', {'lazyllm': mock_lazyllm}):
            from services.ai_providers.text.lazyllm_provider import LazyLLMTextProvider

            # Simulate caption provider creation (what get_caption_provider does)
            caption_provider = LazyLLMTextProvider(source='qwen', model='qwen-vl-max')
            text_provider = LazyLLMTextProvider(source='qwen', model='qwen-max')

        # Both providers created successfully; text provider is LLM, caption is VLM-only
        assert text_provider._is_vlm_only is False
        assert caption_provider._is_vlm_only is True
