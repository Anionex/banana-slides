"""
Lazyllm framework implementation for image editing and generation

Support models:
- qwen-image-edit
- qwen-image-edit-plus
- qwen-image-edit-plus-2025-10-30

- doubao-seedream-4.5
- doubao-seedream-4-0-250828
- doubao-seededit-3-0-i2i-250628
"""
import tempfile
import os
import lazyllm
from typing import Optional, List
from PIL import Image
from .base import ImageProvider
from config import get_config
from lazyllm.components.formatter import decode_query_with_filepaths
from lazyllm import LOG


class LazyllmImageProvider(ImageProvider):
    """Image generation using Lazyllm framework"""
    def __init__(self, source: str = 'doubao', model: str = 'doubao-seedream-4-0-250828',
                 api_key: str = None):
        """
        Initialize GenAI image provider

        Args:
            source: image_editing model provider, support qwen,doubao,siliconflow now.
            model: Model name to use
            api_key: qwen/doubao/siliconflow API key
        """
        self.client = lazyllm.OnlineModule(
            source=source,
            model=model,
            api_key=api_key,
            type='image_editing', # 指定模型类型:图片编辑模型。
        )

    def generate_image(self, prompt: str = None, ref_images: Optional[List[Image.Image]] = None, 
                       aspect_ratio = "16:9", resolution = "4K") -> Optional[Image.Image]:
        # 将 PIL Image 对象转换为文件路径:lazyllm传入参考图片需要以字符串格式的路径传入。
        file_paths = None
        if ref_images:
            file_paths = []
            for i, img in enumerate(ref_images):
                temp_path = os.path.join(tempfile.gettempdir(), f'lazyllm_ref_{i}.png')
                img.save(temp_path)
                file_paths.append(temp_path)
        response_path = self.client(input=prompt, files=file_paths, size=resolution)
        image_path = decode_query_with_filepaths(response_path) # dict
        if not image_path:
            LOG.warning('No images found in response')
            raise ValueError()
        # 从 dict 中取出图片路径
        if isinstance(image_path, dict):
            files = image_path.get('files')
            if files and isinstance(files, list) and len(files) > 0:
                image_path = files[0]  # 取第一个图片路径
            else:
                LOG.warning('No valid image path in response')
                return None

        LOG.info(f'Found image: {image_path}')
        try:
            image = Image.open(image_path)
            LOG.info(f'✓ Successfully loaded image from: {image_path}')
            return image
        except Exception as e:
            LOG.error(f'✗ Failed to load image: {e}')   
        LOG.warning('No valid images could be loaded')
        return None
