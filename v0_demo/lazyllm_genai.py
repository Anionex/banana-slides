"""
LazyLLM Demo for Image and Text Generation

This demo module provides simple APIs for image editing/generation and text generation
using the LazyLLM framework, mimicking the style of gemini_genai.py.

Supported Image Providers:
  - qwen (阿里云通义千问)
  - doubao (火山引擎豆包)
  - siliconflow (硅基流动)

Supported Text Providers:
  - deepseek
  - qwen
  - doubao
  - glm
  - siliconflow

Before running this demo, you need to configure the providers' api_key in the environment variables based on your choice.
defaut source is qwen.
e.g.:
    export BANANA_QWEN_API_KEY = "your-api-key"

"""
import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from PIL import Image
from lazyllm.components.formatter import decode_query_with_filepaths

# Load environment variables from project root
_project_root = Path(__file__).parent.parent
_env_file = _project_root / '.env'
load_dotenv(dotenv_path=_env_file, override=True)

import lazyllm
from lazyllm import LOG

# ===== Configuration =====
DEFAULT_ASPECT_RATIO = "16:9"  # "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"
DEFAULT_RESOLUTION = "2K"      # "1K", "2K", "4K"

# default sources and models
DEFAULT_TEXT_SOURCE = 'qwen'
DEFAULT_TEXT_MODEL = 'deepseek-v3.2'

DEFAULT_IMAGE_SOURCE = 'qwen'
DEFAULT_IMAGE_MODEL = 'qwen-image-edit-plus'

DEFAULT_VLM_SOURCE = 'qwen'
DEFAULT_VLM_MODEL = 'qwen-vl-plus'

# ===== Text Generation =====

def gen_text(prompt: str, 
             source: str = DEFAULT_TEXT_SOURCE,
             model: str = DEFAULT_TEXT_MODEL,
            ) -> str:
    client = lazyllm.namespace('BANANA').OnlineModule(
        source=source,
        model=model,
        type='llm',
    )
    result = client(prompt)
    return result

def gen_json_text(prompt: str,
                  source: str = DEFAULT_TEXT_SOURCE,
                  model: str = DEFAULT_TEXT_MODEL,
                  ) -> str:
    text = gen_text(prompt, source=source, model=model)
    # Clean up JSON formatting (remove markdown code blocks if present)
    cleaned_text = text.strip().strip("```json").strip("```").strip()
    return cleaned_text

# ===== Image Generation/Editing =====

def gen_image(prompt: str,
              ref_image_path: Optional[str] = None,
              source: str = DEFAULT_IMAGE_SOURCE,
              model: str = DEFAULT_IMAGE_MODEL,
              aspect_ratio: str = DEFAULT_ASPECT_RATIO,
              resolution: str = DEFAULT_RESOLUTION,
              ) -> Optional[Image.Image]:
    # Convert resolution shorthand to actual resolution
    resolution_map = {
        "1K": "1920*1080",
        "2K": "2048*1080",
        "4K": "3840*2160"
    }
    actual_resolution = resolution_map.get(resolution, resolution)
    client = lazyllm.namespace('BANANA').OnlineModule(
        source=source,
        model=model,
        type='image_editing',
    )
    
    # Prepare file paths if reference image is provided
    file_paths = None
    if ref_image_path:
        if not os.path.exists(ref_image_path):
            raise FileNotFoundError(f"Reference image not found: {ref_image_path}")
        file_paths = [ref_image_path]
    response_path = client(prompt, lazyllm_files=file_paths, size=actual_resolution)
    image_path = decode_query_with_filepaths(response_path)
    
    if not image_path:
        LOG.warning('No images found in response')
        return None
    
    # Extract image path from response
    if isinstance(image_path, dict):
        files = image_path.get('files', [])
        if files and isinstance(files, list) and len(files) > 0:
            image_path = files[0]
        else:
            LOG.warning('No valid image path in response')
            return None
    
    # Load and return image
    try:
        image = Image.open(image_path)
        LOG.info(f'✓ Image loaded successfully from: {image_path}')
        return image
    except Exception as e:
        LOG.error(f'✗ Failed to load image: {e}')
        return None


# ===== Vision/VLM (Image Captioning) =====

def describe_image(image_path: str,
                   prompt: Optional[str] = None,
                   source: str = DEFAULT_VLM_SOURCE,
                   model: str = DEFAULT_VLM_MODEL,
                    ) -> str:
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")
    if not prompt:
        prompt = "Please describe this image in detail."
    client = lazyllm.namespace('BANANA').OnlineModule(
        source=source,
        model=model,
        type='vlm',
    )
    
    # Call with image file path
    result = client(prompt, lazyllm_files=[image_path])
    LOG.info(f"✓ Image description generated successfully from {source}")
    return result


# ===== Demo/Testing =====

if __name__ == "__main__":
    print("=" * 60)
    print("LazyLLM Demo - Text and Image Generation")
    print("=" * 60)
    
    # Test 1: Text Generation
    print("\n[Test 1] Text Generation (Deepseek)")
    try:
        text = gen_text("中国的首都是哪里?")
        print(f"Result: {text[:100]}...")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 2: JSON Text Generation
    print("\n[Test 2] JSON Text Generation")
    try:
        json_text = gen_json_text(
            "随机生成一个JSON文件，包含姓名、年龄、性别三个字段"
        )
        print(f"Result: {json_text}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 3: Image Generation and Editing
    print("\n[Test 3] Image Generation (Qwen)")
    try:
        image = gen_image(
            "在参考图片中插入 'lazyllm' 这串英文",
            ref_image_path='path/to/your/image.png', # depending on your local image path
            source="qwen",
            resolution="2K"
        )
        if image:
            print(f"✓ Image generated: {image.size}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 4: Image Description
    print("\n[Test 4] Image Description (Qwen VLM)")
    try:
        # Create a test image if it doesn't exist
        test_image_path = 'path/to/your/image.png' # depending on your local image path
        if not os.path.exists(test_image_path):
            print(f"Please provide a test image at {test_image_path}")
        else:
            caption = describe_image(test_image_path)
            print(f"Caption: {caption}")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "=" * 60)
    print("Demo Complete!")
    print("=" * 60)