"""
LazyLLM Demo for Image and Text Generation

This demo module provides simple APIs for image editing/generation and text generation
using the LazyLLM framework, mimicking the style of gemini_genai.py.

Supported Image Providers:
  - qwen (阿里云通义千问): qwen-image-edit, qwen-image-edit-plus
  - doubao (火山引擎豆包): doubao-seedream-4-0-250828, doubao-seedream-4.5
  - siliconflow (硅基流动): Various image models

Supported Text Providers:
  - deepseek: deepseek-v3, deepseek-v3.2
  - qwen: qwen-max, qwen-plus, qwen-turbo
  - doubao: doubao-pro-128k, doubao-lite-128k
  - glm: glm-4, glm-4-plus
  - siliconflow: Various text models
"""
import os
import sys
from pathlib import Path
from typing import Optional, List
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

# LazyLLM default sources (from .env)
DEFAULT_TEXT_SOURCE = os.getenv("LAZYLLM_TEXT_SOURCE", "qwen")
DEFAULT_TEXT_MODEL = os.getenv("TEXT_MODEL", "deepseek-v3.2")

DEFAULT_IMAGE_SOURCE = os.getenv("LAZYLLM_IMAGE_SOURCE", "qwen")
DEFAULT_IMAGE_MODEL = os.getenv("IMAGE_MODEL", "qwen-image-edit")

DEFAULT_VLM_SOURCE = os.getenv("LAZYLLM_IMAGE_CAPTION_SOURCE", "qwen")
DEFAULT_VLM_MODEL = os.getenv("IMAGE_CAPTION_MODEL", "qwen-vl-plus")

# API Keys from environment variables
API_KEYS = {
    'qwen': os.getenv("LAZYLLM_QWEN_API_KEY", ""),
    'doubao': os.getenv("LAZYLLM_DOUBAO_API_KEY", ""),
    'deepseek': os.getenv("LAZYLLM_DEEPSEEK_API_KEY", ""),
    'glm': os.getenv("LAZYLLM_GLM_API_KEY", ""),
    'siliconflow': os.getenv("LAZYLLM_SILICONFLOW_API_KEY", ""),
    'sensenova': os.getenv("LAZYLLM_SENSENOVA_API_KEY", ""),
    'minimax': os.getenv("LAZYLLM_MINIMAX_API_KEY", ""),
}


def _get_api_key(source: str) -> str:
    """Get API key for the specified source"""
    api_key = API_KEYS.get(source.lower(), "")
    if not api_key:
        raise ValueError(
            f"API key not found for source '{source}'. "
            f"Please set LAZYLLM_{source.upper()}_API_KEY in .env file."
        )
    return api_key


# ===== Text Generation =====

def gen_text(prompt: str, 
             source: str = DEFAULT_TEXT_SOURCE,
             model: str = DEFAULT_TEXT_MODEL,
             api_key: str = None) -> str:
    if not api_key:
        api_key = _get_api_key(source)
    client = lazyllm.OnlineModule(
        source=source,
        model=model,
        api_key=api_key,
        type='llm',
    )
    result = client(prompt)
    return result

def gen_json_text(prompt: str,
                  source: str = DEFAULT_TEXT_SOURCE,
                  model: str = DEFAULT_TEXT_MODEL,
                  api_key: str = None) -> str:
    text = gen_text(prompt, source=source, model=model, api_key=api_key)
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
              api_key: str = None) -> Optional[Image.Image]:
    if not api_key:
        api_key = _get_api_key(source)
    
    # Convert resolution shorthand to actual resolution
    resolution_map = {
        "1K": "1920*1080",
        "2K": "2048*1080",
        "4K": "3840*2160"
    }
    actual_resolution = resolution_map.get(resolution, resolution)
    client = lazyllm.OnlineModule(
        source=source,
        model=model,
        api_key=api_key,
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
                   api_key: str = None) -> str:
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")
    if not api_key:
        api_key = _get_api_key(source)
    if not prompt:
        prompt = "Please describe this image in detail."
    client = lazyllm.OnlineModule(
        source=source,
        model=model,
        api_key=api_key,
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
            ref_image_path='D:\\1.png', # depending on your local image path
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
        test_image_path = 'D:\\1.png' # depending on your local image pat
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