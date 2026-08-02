"""
Integration test for Seedream 5.0 guidance_scale parameter fix.

Verifies that the monkey-patch correctly removes the unsupported guidance_scale
parameter for Seedream 5.0+ models while preserving it for older models.
"""
import pytest
from unittest.mock import Mock, patch, MagicMock


class TestSeedream5GuidanceScalePatch:
    """Test the conditional removal of guidance_scale parameter for Seedream 5.0+ models."""

    @pytest.fixture
    def mock_lazyllm(self):
        """Mock the lazyllm module and its dependencies."""
        with patch('services.ai_providers.image.lazyllm_provider.ensure_lazyllm_namespace_key'):
            # Create mock lazyllm module structure
            mock_lazyllm_module = MagicMock()
            mock_namespace = MagicMock()
            mock_online_module = MagicMock()

            # Setup the namespace chain
            mock_lazyllm_module.namespace.return_value = mock_namespace
            mock_namespace.OnlineModule.return_value = mock_online_module

            # Create mock client structure for images.generate
            mock_client = MagicMock()
            mock_images = MagicMock()
            mock_client.images = mock_images
            mock_online_module._client = mock_client

            # Track calls to the original generate method
            original_generate_calls = []
            def track_generate(*args, **kwargs):
                original_generate_calls.append(kwargs.copy())
                return "mock_image_path"

            mock_images.generate = Mock(side_effect=track_generate)

            with patch.dict('sys.modules', {'lazyllm': mock_lazyllm_module}):
                yield {
                    'lazyllm': mock_lazyllm_module,
                    'online_module': mock_online_module,
                    'images': mock_images,
                    'calls': original_generate_calls
                }

    def test_seedream5_removes_guidance_scale(self, mock_lazyllm):
        """Test that guidance_scale is removed for Seedream 5.0 models."""
        from services.ai_providers.image.lazyllm_provider import LazyLLMImageProvider

        # Initialize provider with Seedream 5.0 model
        provider = LazyLLMImageProvider(
            source='doubao',
            model='doubao-seedream-5-0-260128'
        )

        # Verify the patch was applied
        images_resource = provider.client._client.images
        assert hasattr(images_resource.generate, '__is_patched_for_seedream5__')
        assert images_resource.generate.__is_patched_for_seedream5__ is True

        # Simulate a call with guidance_scale parameter (as lazyllm would do)
        mock_lazyllm['calls'].clear()
        images_resource.generate(
            model='doubao-seedream-5-0-260128',
            prompt='test prompt',
            guidance_scale=2.5,
            size='1920x1080'
        )

        # Verify guidance_scale was removed
        assert len(mock_lazyllm['calls']) == 1
        call_kwargs = mock_lazyllm['calls'][0]
        assert 'guidance_scale' not in call_kwargs
        assert call_kwargs['model'] == 'doubao-seedream-5-0-260128'
        assert call_kwargs['prompt'] == 'test prompt'
        assert call_kwargs['size'] == '1920x1080'

    def test_seedream4_preserves_guidance_scale(self, mock_lazyllm):
        """Test that guidance_scale is preserved for Seedream 4.0 models."""
        from services.ai_providers.image.lazyllm_provider import LazyLLMImageProvider

        # Initialize provider with Seedream 4.0 model (should NOT apply patch)
        provider = LazyLLMImageProvider(
            source='doubao',
            model='doubao-seedream-4-0-250828'
        )

        # Verify the patch was NOT applied (since it's not seedream-5)
        images_resource = provider.client._client.images
        assert not hasattr(images_resource.generate, '__is_patched_for_seedream5__')

        # Simulate a call with guidance_scale parameter
        mock_lazyllm['calls'].clear()
        images_resource.generate(
            model='doubao-seedream-4-0-250828',
            prompt='test prompt',
            guidance_scale=2.5,
            size='1920x1080'
        )

        # Verify guidance_scale was preserved
        assert len(mock_lazyllm['calls']) == 1
        call_kwargs = mock_lazyllm['calls'][0]
        assert 'guidance_scale' in call_kwargs
        assert call_kwargs['guidance_scale'] == 2.5

    def test_patch_idempotency(self, mock_lazyllm):
        """Test that the patch is only applied once even if called multiple times."""
        from services.ai_providers.image.lazyllm_provider import LazyLLMImageProvider

        # Create first provider instance
        provider1 = LazyLLMImageProvider(
            source='doubao',
            model='doubao-seedream-5-0-260128'
        )

        images_resource = provider1.client._client.images
        first_generate = images_resource.generate

        # Create second provider instance with same model
        provider2 = LazyLLMImageProvider(
            source='doubao',
            model='doubao-seedream-5-0-260128'
        )

        # Verify the generate method is the same (not re-patched)
        assert provider2.client._client.images.generate is first_generate

    def test_conditional_removal_based_on_runtime_model(self, mock_lazyllm):
        """Test that guidance_scale removal is conditional based on runtime model parameter."""
        from services.ai_providers.image.lazyllm_provider import LazyLLMImageProvider

        # Initialize with Seedream 5.0 to apply the patch
        provider = LazyLLMImageProvider(
            source='doubao',
            model='doubao-seedream-5-0-260128'
        )

        images_resource = provider.client._client.images

        # Test 1: Call with seedream-5 model - should remove guidance_scale
        mock_lazyllm['calls'].clear()
        images_resource.generate(
            model='doubao-seedream-5-0-260128',
            guidance_scale=2.5
        )
        assert 'guidance_scale' not in mock_lazyllm['calls'][0]

        # Test 2: Call with seedream-4 model - should preserve guidance_scale
        mock_lazyllm['calls'].clear()
        images_resource.generate(
            model='doubao-seedream-4-0-250828',
            guidance_scale=2.5
        )
        assert 'guidance_scale' in mock_lazyllm['calls'][0]
        assert mock_lazyllm['calls'][0]['guidance_scale'] == 2.5
