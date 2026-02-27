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
import re
import tempfile
import os
import logging
import requests
from io import BytesIO
from typing import Optional, List, Tuple
from PIL import Image
from .base import ImageProvider
from ..lazyllm_env import ensure_lazyllm_namespace_key

logger = logging.getLogger(__name__)

# Vendor-specific image dimension constraints
# Format: vendor -> (min_dimension, max_dimension, min_total_pixels, separator)
VENDOR_IMAGE_CONSTRAINTS = {
    'qwen': {
        'min_dim': 512,
        'max_dim': 2048,
        'min_pixels': None,  # No minimum total pixels requirement
        'separator': '*',
    },
    'doubao': {
        'min_dim': None,
        'max_dim': None,
        'min_pixels': 3686400,  # ~1920x1920, required by seedream models
        'separator': 'x',
    },
}
DEFAULT_CONSTRAINTS = {
    'min_dim': None,
    'max_dim': None,
    'min_pixels': None,
    'separator': 'x',
}


def _calculate_image_dimensions(
    resolution: str,
    aspect_ratio: str,
    source: str
) -> Tuple[int, int, str]:
    """
    Calculate image dimensions based on resolution, aspect ratio, and vendor constraints.

    Args:
        resolution: Resolution preset (1K, 2K, 4K)
        aspect_ratio: Aspect ratio (16:9, 4:3, 1:1)
        source: Vendor name (qwen, doubao, etc.)

    Returns:
        Tuple of (width, height, size_string)
    """
    aspect_ratios = {
        "16:9": (16, 9),
        "9:16": (9, 16),
        "4:3": (4, 3),
        "3:4": (3, 4),
        "3:2": (3, 2),
        "2:3": (2, 3),
        "1:1": (1, 1),
    }
    resolution_base = {
        "1K": 1024,
        "2K": 2048,
        "4K": 4096,
    }

    constraints = VENDOR_IMAGE_CONSTRAINTS.get(source, DEFAULT_CONSTRAINTS)
    min_dim = constraints['min_dim']
    max_dim = constraints['max_dim']
    min_pixels = constraints['min_pixels']
    sep = constraints['separator']

    # Start with base resolution
    base = resolution_base.get(resolution, 2048)
    if max_dim and base > max_dim:
        base = max_dim

    # Calculate dimensions from aspect ratio
    ratio = aspect_ratios.get(aspect_ratio)
    if not ratio:
        # Parse arbitrary "W:H" format
        parts = aspect_ratio.split(':')
        if len(parts) == 2:
            try:
                ratio = (int(parts[0]), int(parts[1]))
            except ValueError:
                pass
        if not ratio:
            logger.warning(f"Unknown aspect_ratio '{aspect_ratio}', falling back to 16:9")
            ratio = (16, 9)
    if ratio[0] >= ratio[1]:
        w = base
        h = int(base * ratio[1] / ratio[0])
    else:
        h = base
        w = int(base * ratio[0] / ratio[1])

    # Scale up if total pixels below minimum (e.g., doubao requires >= 3686400)
    if min_pixels:
        total = w * h
        if total < min_pixels:
            scale = (min_pixels / total) ** 0.5
            w = int(w * scale)
            h = int(h * scale)

    # Round up to nearest multiple of 64 (common GPU alignment requirement)
    w = max(64, ((w + 63) // 64) * 64)
    h = max(64, ((h + 63) // 64) * 64)

    # Enforce minimum dimension if specified
    if min_dim:
        w = max(min_dim, w)
        h = max(min_dim, h)

    return w, h, f"{w}{sep}{h}"


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
        try:
            import lazyllm
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "lazyllm is required when AI_PROVIDER_FORMAT=lazyllm. "
                "Please install backend dependencies including lazyllm."
            ) from exc

        ensure_lazyllm_namespace_key(source, namespace='BANANA')
        self._source = source
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
        # Calculate vendor-specific image dimensions
        w, h, size_str = _calculate_image_dimensions(resolution, aspect_ratio, self._source)
        logger.info(f"[LazyLLM] aspect_ratio={aspect_ratio}, resolution={resolution}, size={size_str}")
        # Convert a PIL Image object to a file path: When passing a reference image to lazyllm, you need to input a path in string format.
        file_paths = None
        temp_paths = []
        decode_query_with_filepaths = None
        try:
            from lazyllm.components.formatter import decode_query_with_filepaths as _decoder
            decode_query_with_filepaths = _decoder
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "lazyllm is required when AI_PROVIDER_FORMAT=lazyllm. "
                "Please install backend dependencies including lazyllm."
            ) from exc
        if ref_images:
            file_paths = []
            for img in ref_images:
                with tempfile.NamedTemporaryFile(prefix='lazyllm_ref_', suffix='.png', delete=False) as tmp:
                    temp_path = tmp.name
                img.save(temp_path)
                file_paths.append(temp_path)
                temp_paths.append(temp_path)
        try:
            try:
                response_path = self.client(prompt, lazyllm_files=file_paths, size=size_str)
            except Exception as client_err:
                # LazyLLM may fail internally when the image URL returns application/octet-stream
                # instead of image/*. In that case, extract the URL and download manually.
                err_str = str(client_err)
                if 'content type' in err_str.lower() or 'Failed to load image from' in err_str:
                    url_match = re.search(r'(https://[^\s"\'<>]+)', err_str)
                    if url_match:
                        url = url_match.group(1).rstrip('.')
                        # Only fetch from known image-hosting domains to prevent SSRF
                        from urllib.parse import urlparse
                        host = urlparse(url).hostname or ''
                        allowed = host == 's3.siliconflow.cn' or host.endswith('.s3.amazonaws.com')
                        if not allowed:
                            logger.warning(f"[LazyLLM] Untrusted host '{host}', skipping manual download")
                            raise
                        logger.warning(
                            f"[LazyLLM] Content-type mismatch, downloading image manually: {url[:80]}..."
                        )
                        max_size = 20 * 1024 * 1024  # 20 MB
                        resp = requests.get(url, timeout=60, stream=True)
                        resp.raise_for_status()
                        content = b""
                        for chunk in resp.iter_content(chunk_size=8192):
                            content += chunk
                            if len(content) > max_size:
                                raise ValueError(f"Image too large (>{max_size // 1024 // 1024}MB)")
                        result = Image.open(BytesIO(content)).copy()
                        logger.info(f"[LazyLLM] Manual download succeeded, size: {result.size}")
                        return result
                raise

            image_path = decode_query_with_filepaths(response_path) # dict
            if not image_path:
                logger.warning('No images found in response')
                raise ValueError()
            if isinstance(image_path, dict):
                files = image_path.get('files')
                if files and isinstance(files, list) and len(files) > 0:
                    image_path = files[0]
                else:
                    logger.warning('No valid image path in response')
                    return None
            try:
                with Image.open(image_path) as image:
                    result = image.copy()
                logger.info(f'Successfully loaded image from: {image_path}, actual size: {result.size[0]}x{result.size[1]} (requested: {size_str})')
                return result
            except Exception as e:
                logger.error(f'Failed to load image: {e}')
            logger.warning('No valid images could be loaded')
            return None
        finally:
            for temp_path in temp_paths:
                try:
                    os.remove(temp_path)
                except OSError:
                    pass
