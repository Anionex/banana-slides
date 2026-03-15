#!/usr/bin/env python3
"""Manual test script for Seedream 5.0 guidance_scale fix."""
import os
import sys

# Set API key
os.environ['DOUBAO_API_KEY'] = '471fe352-a2f3-498b-94be-cf0f165fae37'

# Add backend to path
sys.path.insert(0, 'backend')

from services.ai_providers.image.lazyllm_provider import LazyLLMImageProvider

print("Testing Seedream 5.0 image generation...")
print("=" * 60)

try:
    # Initialize provider with Seedream 5.0
    provider = LazyLLMImageProvider(
        source='doubao',
        model='doubao-seedream-5-0-260128'
    )
    print("✓ Provider initialized")

    # Generate image
    print("\nGenerating image (this may take 10-30 seconds)...")
    result = provider.generate_image(
        prompt='A simple red circle on white background',
        aspect_ratio='1:1',
        resolution='1K'
    )

    if result:
        print(f"✅ SUCCESS! Image generated: {result.size}")
        print("\nThe fix works! Seedream 5.0 can generate images without guidance_scale error.")
    else:
        print("❌ FAILED: Image generation returned None")

except Exception as e:
    error_msg = str(e)
    if 'guidance_scale' in error_msg.lower():
        print(f"❌ CRITICAL FAILURE: guidance_scale error still occurs!")
        print(f"Error: {error_msg}")
    else:
        print(f"❌ Error (not guidance_scale related): {error_msg}")
    sys.exit(1)
