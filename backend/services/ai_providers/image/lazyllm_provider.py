"""
Lazyllm framework implementation for image editing and generation

Support models:
- qwen-image-edit
- qwen-image-edit-plus
- qwen-image-edit-plus-2025-10-30
- ...

- doubao-seedream-4-0-250828
- doubao-seededit-3-0-i2i-250628
- doubao-seedream-4.5
- ...
"""
import tempfile
import os
from typing import Optional, List
from PIL import Image
from .base import ImageProvider
from config import get_config
import lazyllm
from lazyllm.components.formatter import decode_query_with_filepaths
from lazyllm import LOG

class LazyLLMImageProvider(ImageProvider):
    """Image generation using Lazyllm framework"""
    def __init__(self, source: str = 'doubao', model: str = 'doubao-seedream-4-0-250828'):
        """
        Initialize GenAI image provider

        Args:
            source: image_editing model provider, support qwen,doubao,siliconflow now.
            model: Model name to use
            type: Category of the online service. Defaults to ``llm``.
        """
        self.client = lazyllm.namespace('BANANA').OnlineModule(
            source=source,
            model=model,
            type='image_editing',
        )

    def generate_image(self, prompt: str = None, 
                       ref_images: Optional[List[Image.Image]] = None, 
                       aspect_ratio = "16:9", 
                       resolution = "1920*1080",
                       enable_thinking: bool = False,
                       thinking_budget: int = 0
                       ) -> Optional[Image.Image]:
        resolution_map = {
            "1K": "1920*1080",
            "2K": "2048*1080",
            "4K": "3840*2160"
        }
        if resolution in resolution_map:
            resolution = resolution_map[resolution]
        # Convert a PIL Image object to a file path: When passing a reference image to lazyllm, you need to input a path in string format.
        file_paths = None
        if ref_images:
            file_paths = []
            for i, img in enumerate(ref_images):
                temp_path = os.path.join(tempfile.gettempdir(), f'lazyllm_ref_{i}.png')
                img.save(temp_path)
                file_paths.append(temp_path)
        response_path = self.client(prompt, lazyllm_files=file_paths, size=resolution)
        image_path = decode_query_with_filepaths(response_path) # dict
        if not image_path:
            LOG.warning('No images found in response')
            raise ValueError()
        if isinstance(image_path, dict):
            files = image_path.get('files')
            if files and isinstance(files, list) and len(files) > 0:
                image_path = files[0]
            else:
                LOG.warning('No valid image path in response')
                return None
        try:
            image = Image.open(image_path)
            LOG.info(f'✓ Successfully loaded image from: {image_path}')
            return image
        except Exception as e:
            LOG.error(f'✗ Failed to load image: {e}')   
        LOG.warning('No valid images could be loaded')
        return None
