"""
Real API integration test for Seedream 5.0 guidance_scale fix.

This test makes REAL API calls to verify the fix works in production.
Requires valid DOUBAO_API_KEY in environment and lazyllm installed.

Cost: ~$0.01-0.05 per test run (actual image generation)
"""
import pytest
import os
from PIL import Image

# Check if lazyllm is available
try:
    import lazyllm
    LAZYLLM_AVAILABLE = True
except ImportError:
    LAZYLLM_AVAILABLE = False


@pytest.mark.skipif(
    not LAZYLLM_AVAILABLE or not os.getenv('DOUBAO_API_KEY'),
    reason="Requires lazyllm installed and DOUBAO_API_KEY for real API testing"
)
class TestSeedream5RealAPI:
    """Real API tests - makes actual calls to Volcano Engine API."""

    def test_seedream5_image_generation_succeeds(self):
        """
        CRITICAL TEST: Verify Seedream 5.0 image generation works without 400 error.

        This test:
        1. Uses real Seedream 5.0 model
        2. Makes actual API call
        3. Verifies no "guidance_scale is not supported" error
        4. Verifies image is generated successfully
        """
        from backend.services.ai_providers.image.lazyllm_provider import LazyLLMImageProvider

        # Initialize with Seedream 5.0 model
        provider = LazyLLMImageProvider(
            source='doubao',
            model='doubao-seedream-5-0-260128'
        )

        # Attempt to generate image
        # Without the fix, this would fail with:
        # "400 Bad Request: The parameter guidance_scale is not supported by the current model"
        try:
            result = provider.generate_image(
                prompt='A simple red circle on white background',
                aspect_ratio='1:1',
                resolution='1K'
            )

            # Verify image was generated
            assert result is not None, "Image generation returned None"
            assert isinstance(result, Image.Image), "Result is not a PIL Image"
            assert result.size[0] > 0 and result.size[1] > 0, "Image has invalid dimensions"

            print(f"✅ Seedream 5.0 image generated successfully: {result.size}")

        except Exception as e:
            error_msg = str(e)

            # Check if it's the guidance_scale error
            if 'guidance_scale' in error_msg.lower() and 'not supported' in error_msg.lower():
                pytest.fail(
                    f"CRITICAL: The fix did not work! Still getting guidance_scale error:\n{error_msg}"
                )
            else:
                # Some other error - re-raise for investigation
                raise

    def test_seedream4_still_works(self):
        """
        Verify older Seedream 4.0 models still work (not broken by the fix).
        """
        from backend.services.ai_providers.image.lazyllm_provider import LazyLLMImageProvider

        provider = LazyLLMImageProvider(
            source='doubao',
            model='doubao-seedream-4-0-250828'
        )

        try:
            result = provider.generate_image(
                prompt='A simple blue square on white background',
                aspect_ratio='1:1',
                resolution='1K'
            )

            assert result is not None
            assert isinstance(result, Image.Image)
            print(f"✅ Seedream 4.0 still works: {result.size}")

        except Exception as e:
            pytest.fail(f"Seedream 4.0 broken by the fix: {e}")


@pytest.mark.skipif(
    bool(os.getenv('DOUBAO_API_KEY')) and LAZYLLM_AVAILABLE,
    reason="Skip when API key is present (real test will run instead)"
)
def test_reminder_to_run_real_tests():
    """
    Reminder: Real API tests are skipped without credentials.

    To run real verification:
    1. Set DOUBAO_API_KEY environment variable
    2. Ensure lazyllm is installed: uv pip install "lazyllm[online-advanced]"
    3. Run: pytest backend/tests/integration/test_seedream5_real_api.py -v
    """
    pytest.skip(
        "Real API tests skipped - set DOUBAO_API_KEY and install lazyllm to run actual verification"
    )
