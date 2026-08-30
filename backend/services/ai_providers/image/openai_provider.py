"""
OpenAI SDK implementation for image generation

Two code paths:
1. Native images API (gpt-image-2, dall-e-3, dall-e-2): uses client.images.generate /
   client.images.edit, returns b64_json directly.
2. Chat completions path (Gemini-via-proxy, etc.): uses client.chat.completions.create
   with modalities=["text","image"] and extra_body resolution hints.

Resolution validation is handled at the task_manager level for all providers.
"""
import logging
import base64
import math
import re
import requests
import time
from io import BytesIO
from typing import Optional, List
from openai import OpenAI
from PIL import Image
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception
from .base import ImageProvider
from config import get_config

logger = logging.getLogger(__name__)

APIMART_TASK_POLL_INTERVAL = 5.0
APIMART_TASK_TIMEOUT = 300.0
APIMART_TASK_REQUEST_TIMEOUT = 30.0


# Models that use the native OpenAI images API (images.generate / images.edit)
# rather than the chat completions multimodal path.
_GPT_IMAGE_MODELS = {'gpt-image-1', 'gpt-image-1.5', 'gpt-image-2'}
_DALLE_MODELS = {'dall-e-2', 'dall-e-3'}
_NATIVE_IMAGES_API_MODELS = _GPT_IMAGE_MODELS | _DALLE_MODELS
_MAX_GPT_IMAGE_INPUTS = 16

# Volcengine Seedream models only accept the native images API (images/generations).
# The Agent Plan endpoint does not expose a chat-completions image modality, so an
# 'auto' protocol must route these models to images.generate instead of chat.completions.
_DOUBAO_SEEDREAM_PREFIX = 'doubao-seedream'

# SenseNova U1 image models use its native JSON images API. The OpenAI SDK
# sends images.edit as multipart form data, which SenseNova rejects.
_SENSENOVA_IMAGE_MODEL_PREFIX = 'sensenova-u1'
_SENSENOVA_IMAGE_REFERENCE_MIN_EDGE = 256
_SENSENOVA_IMAGE_REFERENCE_MAX_EDGE = 4096
# The editing endpoint requires the uploaded reference image itself to be
# within 2:1, while generated output sizes allow up to 3:1.
_SENSENOVA_IMAGE_REFERENCE_MAX_ASPECT = 2.0
_SENSENOVA_IMAGE_MAX_ASPECT = 3.0
_SENSENOVA_IMAGE_MIN_EDGE = 512
_SENSENOVA_IMAGE_MAX_EDGE = 4096
_SENSENOVA_IMAGE_ALIGNMENT = 32
_SENSENOVA_IMAGE_REFERENCE_MAX_BYTES = 10 * 1024 * 1024
_SENSENOVA_MAX_ATTEMPTS = max(1, get_config().OPENAI_MAX_RETRIES + 1)
_SENSENOVA_RETRY_STATUS_CODES = {429, 500, 502, 503, 504}

_SENSENOVA_RESOLUTION_LONG_EDGE = {
    '1K': 1280,
    '2K': 2048,
    '4K': 4096,
}

_SENSENOVA_FIXED_SIZE_MODEL_NAMES = {
    'sensenova-u1',
    'sensenova-u1-fast',
    'sensenova-u1.5-fast',
}
_SENSENOVA_EDIT_MODEL_NAMES = {'sensenova-u1.5-lite'}

# SenseNova U1 Fast only accepts these explicit dimensions. Do not send a
# computed size for this model: a wrong value is rejected with invalid arguments.
_SENSENOVA_U1_FAST_SIZE_PRESETS = {
    '1:1': '2048x2048',
    '16:9': '2752x1536',
    '9:16': '1536x2752',
    '2:3': '1664x2496',
    '3:2': '2496x1664',
    '3:4': '1760x2368',
    '4:3': '2368x1760',
    '4:5': '1824x2272',
    '5:4': '2272x1824',
    '21:9': '3072x1376',
    '9:21': '1344x3136',
}


def _is_retryable_sensenova_error(exc: BaseException) -> bool:
    """Return True for transient SenseNova HTTP/network failures."""
    if isinstance(exc, requests.exceptions.HTTPError) and exc.response is not None:
        return exc.response.status_code in _SENSENOVA_RETRY_STATUS_CODES
    if isinstance(exc, (
        requests.exceptions.SSLError,
        requests.exceptions.ConnectionError,
        requests.exceptions.Timeout,
        requests.exceptions.ChunkedEncodingError,
    )):
        return True
    return False


def _log_sensenova_retry(retry_state):
    exc = retry_state.outcome.exception() if retry_state.outcome else None
    status = getattr(getattr(exc, 'response', None), 'status_code', '?')
    logger.warning(
        'SenseNova image request failed (%s, HTTP %s), retrying %d/%d: %s',
        type(exc).__name__ if exc else 'UnknownError',
        status,
        retry_state.attempt_number,
        _SENSENOVA_MAX_ATTEMPTS,
        exc,
    )

# Volcengine Seedream Image generation API size constraints
# (https://docs.volcengine.com/docs/82379/1541523, Seedream 5.0-lite / 4.5):
# Method 2 (explicit WxH) accepts any size whose total pixel count lies in
# [2560x1440 = 3,686,400, 4096x4096 = 16,777,216] with an aspect ratio in
# [1/16, 16]. The generic GPT sizing (e.g. 2048x1152 for 16:9 / 2K) falls below
# that floor, so Seedream models must resolve sizes from the official presets.
# The tables below are Volcengine's documented resolution -> size mappings.
_DOUBAO_SEEDREAM_SIZE_PRESETS = {
    '2K': {
        '1:1': '2048x2048', '4:3': '2304x1728', '3:4': '1728x2304',
        '16:9': '2848x1600', '9:16': '1600x2848', '3:2': '2496x1664',
        '2:3': '1664x2496', '21:9': '3136x1344',
    },
    '3K': {
        '1:1': '3072x3072', '4:3': '3456x2592', '3:4': '2592x3456',
        '16:9': '4096x2304', '9:16': '2304x4096', '3:2': '3744x2496',
        '2:3': '2496x3744', '21:9': '4704x2016',
    },
    '4K': {
        '1:1': '4096x4096', '4:3': '4704x3520', '3:4': '3520x4704',
        '16:9': '5504x3040', '9:16': '3040x5504', '3:2': '4992x3328',
        '2:3': '3328x4992', '21:9': '6240x2656',
    },
}
_DOUBAO_SEEDREAM_MIN_PIXELS = 3_686_400
_DOUBAO_SEEDREAM_MAX_PIXELS = 16_777_216

# Aspect-ratio → size per model family.
# DALL-E models only support fixed sizes; gpt-image-* uses dynamic calculation.
_DALLE3_SIZE_MAP = {
    '16:9': '1792x1024',
    '9:16': '1024x1792',
    '1:1':  '1024x1024',
    '3:2':  '1792x1024',
    '2:3':  '1024x1792',
}
_DALLE2_SIZE_MAP = {
    '1:1':  '1024x1024',
}

_RESOLUTION_LONG_EDGE = {
    '1K': 1280,
    '2K': 2048,
    '4K': 3840,
}


def _seedream_pixel_bounds(model: str):
    """Return the (min, max) total-pixel range accepted by a Seedream model."""
    model = model.lower()
    if '5.0-pro' in model or '5-0-pro' in model:
        return 921_600, 4_624_220   # 1280x720 .. 2048x2048x1.1025
    if '4.0' in model or '4-0' in model:
        return 921_600, _DOUBAO_SEEDREAM_MAX_PIXELS
    # Seedream 5.0-lite / 4.5 and unknown variants share the strictest range.
    return _DOUBAO_SEEDREAM_MIN_PIXELS, _DOUBAO_SEEDREAM_MAX_PIXELS


def _scale_size_to_pixel_range(size: str, min_pixels: int, max_pixels: int) -> str:
    """Scale a WxH size so its total pixel count lies in [min_pixels, max_pixels].

    The aspect ratio is preserved. Edges stay multiples of 16: they round up
    when enlarging (guaranteeing the minimum pixel count) and down when
    shrinking (guaranteeing the maximum is not exceeded).
    """
    if not isinstance(size, str):
        return 'auto'
    try:
        w, h = (int(part) for part in size.lower().split('x'))
    except (ValueError, AttributeError):
        return 'auto'
    if w <= 0 or h <= 0:
        return 'auto'
    pixels = w * h
    if pixels < min_pixels:
        scale = (min_pixels / pixels) ** 0.5
        w = math.ceil(w * scale / 16) * 16
        h = math.ceil(h * scale / 16) * 16
    elif pixels > max_pixels:
        scale = (max_pixels / pixels) ** 0.5
        w = max(16, int(w * scale / 16) * 16)
        h = max(16, int(h * scale / 16) * 16)
    return f'{w}x{h}'


def _compute_gpt_image_size(aspect_ratio: str, resolution: str = '2K') -> str:
    """Dynamically compute WxH for gpt-image-* from aspect ratio and resolution.

    Rules: both edges multiples of 16, max edge ≤ 3840, ratio ≤ 3:1.
    """
    parts = aspect_ratio.split(':')
    if len(parts) != 2:
        return 'auto'
    try:
        aw, ah = int(parts[0]), int(parts[1])
    except ValueError:
        return 'auto'
    if aw <= 0 or ah <= 0:
        return 'auto'

    long_edge = _RESOLUTION_LONG_EDGE.get(resolution.upper(), 2048)

    if aw >= ah:
        w = long_edge
        h = round(w * ah / aw)
    else:
        h = long_edge
        w = round(h * aw / ah)

    w = max(16, (w // 16) * 16)
    h = max(16, (h // 16) * 16)

    # Clamp total pixels to API limit (max 8,294,400)
    max_pixels = 8_294_400
    if w * h > max_pixels:
        scale = (max_pixels / (w * h)) ** 0.5
        w = max(16, (int(w * scale) // 16) * 16)
        h = max(16, (int(h * scale) // 16) * 16)

    return f'{w}x{h}'


class OpenAIImageProvider(ImageProvider):
    """
    Image generation using OpenAI SDK.

    Two code paths selected by model name:
    • Native images API (gpt-image-2 / dall-e-*): images.generate / images.edit
    • Chat completions path (Gemini via proxy, etc.): chat.completions with modalities

    Supports multiple resolution parameter formats for different providers.
    Resolution support varies by provider:
    - Some providers support 2K/4K via extra_body parameters
    - Some providers only support 1K regardless of settings
    
    The provider will try multiple parameter formats to maximize compatibility.
    """
    
    def __init__(self, api_key: str, api_base: str = None, model: str = "gemini-3-pro-image-preview", image_api_protocol: str = 'auto'):
        """
        Initialize OpenAI image provider

        Args:
            api_key: API key
            api_base: API base URL (e.g., https://api.inferera.com/v1)
            model: Model name to use
            image_api_protocol: 'auto' (detect by model name), 'images' (force images.generate), 'chat' (force chat.completions)
        """
        self.client = OpenAI(
            api_key=api_key,
            base_url=api_base,
            timeout=get_config().OPENAI_TIMEOUT,  # set timeout from config
            max_retries=get_config().OPENAI_MAX_RETRIES  # set max retries from config
        )
        self.api_key = api_key
        self.api_base = api_base or ""
        self.model = model
        self.image_api_protocol = image_api_protocol or 'auto'
    
    def _encode_image_to_base64(self, image: Image.Image) -> str:
        """
        Encode PIL Image to base64 string
        
        Args:
            image: PIL Image object
            
        Returns:
            Base64 encoded string
        """
        buffered = BytesIO()
        # Convert to RGB if necessary (e.g., RGBA images)
        if image.mode in ('RGBA', 'LA', 'P'):
            image = image.convert('RGB')
        image.save(buffered, format="JPEG", quality=95)
        return base64.b64encode(buffered.getvalue()).decode('utf-8')
    
    def _build_extra_body(self, aspect_ratio: str, resolution: str) -> dict:
        """
        Build extra_body parameters for resolution control.
        
        Uses multiple format strategies to support different providers:
        1. Flat style: aspect_ratio + resolution at top level
        2. Nested style: generationConfig.imageConfig structure
        
        Args:
            aspect_ratio: Image aspect ratio (e.g., "16:9", "9:16")
            resolution: Image resolution ("1K", "2K", "4K")
            
        Returns:
            Dict with extra_body parameters
        """
        # Ensure resolution is uppercase (some providers require "4K" not "4k")
        resolution_upper = resolution.upper()
        
        # Build comprehensive extra_body that works with multiple providers
        extra_body = {
            # Flat style parameters
            "aspect_ratio": aspect_ratio,
            "resolution": resolution_upper,
            
            # Nested style structure (compatible with some providers)
            "generationConfig": {
                "imageConfig": {
                    "aspectRatio": aspect_ratio,
                    "imageSize": resolution_upper,
                }
            }
        }
        
        return extra_body

    def _is_native_images_api_model(self) -> bool:
        """Return True when the model should use images.generate / images.edit."""
        model = self.model.lower()
        return (
            model in _NATIVE_IMAGES_API_MODELS
            or model.startswith(_DOUBAO_SEEDREAM_PREFIX)
            or self._is_sensenova_image_model()
        )

    def _is_sensenova_image_model(self) -> bool:
        """Return True for SenseNova U1 image-generation models."""
        return self.model.lower().startswith(_SENSENOVA_IMAGE_MODEL_PREFIX)

    def _is_sensenova_fixed_size_model(self) -> bool:
        """Return True for SenseNova U1 models with a fixed size table."""
        return self.model.lower() in _SENSENOVA_FIXED_SIZE_MODEL_NAMES

    def _is_sensenova_edit_model(self) -> bool:
        """Return True when the configured model supports reference-image edits."""
        return self.model.lower() in _SENSENOVA_EDIT_MODEL_NAMES

    @staticmethod
    def _fit_sensenova_reference_image(image: Image.Image) -> Image.Image:
        """Fit a reference image to SenseNova's supported dimensions/ratio."""
        source = image.convert('RGBA')
        width, height = source.size
        if width <= 0 or height <= 0:
            raise ValueError('Reference image must have positive dimensions')

        # Resize proportionally. For extreme aspect ratios it is impossible to
        # keep both edges in the min/max range without stretching, so cap the
        # long edge first and pad the short edge below.
        if max(width, height) > _SENSENOVA_IMAGE_REFERENCE_MAX_EDGE:
            scale = _SENSENOVA_IMAGE_REFERENCE_MAX_EDGE / max(width, height)
        elif min(width, height) < _SENSENOVA_IMAGE_REFERENCE_MIN_EDGE:
            scale = _SENSENOVA_IMAGE_REFERENCE_MIN_EDGE / min(width, height)
        else:
            scale = 1.0
        if (
            width * scale > _SENSENOVA_IMAGE_REFERENCE_MAX_EDGE
            or height * scale > _SENSENOVA_IMAGE_REFERENCE_MAX_EDGE
        ):
            scale = _SENSENOVA_IMAGE_REFERENCE_MAX_EDGE / max(width, height)

        content_width = max(1, round(width * scale))
        content_height = max(1, round(height * scale))

        # The edit API accepts reference images within 2:1. Preserve the original
        # content by padding the short edge when it falls outside that range.
        canvas_width, canvas_height = content_width, content_height
        if content_width > content_height * _SENSENOVA_IMAGE_REFERENCE_MAX_ASPECT:
            canvas_height = max(
                _SENSENOVA_IMAGE_REFERENCE_MIN_EDGE,
                math.ceil(content_width / _SENSENOVA_IMAGE_REFERENCE_MAX_ASPECT),
            )
        elif content_height > content_width * _SENSENOVA_IMAGE_REFERENCE_MAX_ASPECT:
            canvas_width = max(
                _SENSENOVA_IMAGE_REFERENCE_MIN_EDGE,
                math.ceil(content_height / _SENSENOVA_IMAGE_REFERENCE_MAX_ASPECT),
            )
        else:
            canvas_width = max(_SENSENOVA_IMAGE_REFERENCE_MIN_EDGE, canvas_width)
            canvas_height = max(_SENSENOVA_IMAGE_REFERENCE_MIN_EDGE, canvas_height)
        canvas = Image.new('RGBA', (canvas_width, canvas_height), (255, 255, 255, 0))
        resized = source.resize((content_width, content_height), Image.LANCZOS)
        canvas.paste(
            resized,
            ((canvas_width - content_width) // 2, (canvas_height - content_height) // 2),
        )
        return canvas

    def _sensenova_reference_data_url(
        self,
        image: Image.Image,
        max_bytes: int = _SENSENOVA_IMAGE_REFERENCE_MAX_BYTES,
    ) -> str:
        """Encode a reference image as a PNG data URL within the API byte limit."""
        fitted = self._fit_sensenova_reference_image(image)
        png = self._sensenova_png_bytes(fitted)
        data_url = f'data:image/png;base64,{base64.b64encode(png).decode()}'
        if len(data_url) <= max_bytes:
            return data_url

        # PNG is preferred because it preserves alpha, but a large 4K reference
        # can still exceed the request limit. Shrink it before sending.
        width, height = fitted.size
        scale = 0.75
        while min(width, height) > _SENSENOVA_IMAGE_REFERENCE_MIN_EDGE:
            next_size = (
                round(width * scale),
                round(height * scale),
            )
            if min(next_size) < _SENSENOVA_IMAGE_REFERENCE_MIN_EDGE:
                break
            smaller = fitted.resize(next_size, Image.LANCZOS)
            png = self._sensenova_png_bytes(smaller)
            data_url = f'data:image/png;base64,{base64.b64encode(png).decode()}'
            if len(data_url) <= max_bytes:
                return data_url
            width, height = next_size
            scale *= 0.75

        raise ValueError(
            'SenseNova reference image is too large after compression; '
            'use a smaller or less detailed image'
        )

    @staticmethod
    def _sensenova_png_bytes(image: Image.Image) -> bytes:
        buf = BytesIO()
        image.save(buf, format='PNG', optimize=True, compress_level=9)
        return buf.getvalue()

    @retry(
        stop=stop_after_attempt(_SENSENOVA_MAX_ATTEMPTS),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception(_is_retryable_sensenova_error),
        reraise=True,
        before_sleep=_log_sensenova_retry,
    )
    def _post_sensenova_with_retry(
        self,
        url: str,
        headers: dict,
        payload: dict,
    ) -> requests.Response:
        """POST to SenseNova with retries for transient HTTP/network errors."""
        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=get_config().OPENAI_TIMEOUT,
        )
        if response.status_code >= 400:
            raise requests.HTTPError(
                f'SenseNova image API returned HTTP {response.status_code}',
                response=response,
            )
        response.raise_for_status()
        return response

    def _pil_to_png_bytes(self, image: Image.Image) -> bytes:
        buf = BytesIO()
        # Preserve alpha channel: the images.edit endpoint uses it as a mask
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        image.save(buf, format='PNG')
        buf.seek(0)
        return buf.read()

    def _resolve_size(self, aspect_ratio: str, resolution: str = '2K') -> str:
        """Map aspect_ratio to a size string appropriate for the current model."""
        model = self.model.lower()
        if self._is_sensenova_image_model():
            return self._resolve_sensenova_size(aspect_ratio, resolution)
        if model == 'dall-e-3':
            return _DALLE3_SIZE_MAP.get(aspect_ratio, '1024x1024')
        if model == 'dall-e-2':
            return _DALLE2_SIZE_MAP.get(aspect_ratio, '1024x1024')
        if model.startswith(_DOUBAO_SEEDREAM_PREFIX):
            return self._resolve_seedream_size(aspect_ratio, resolution)
        return _compute_gpt_image_size(aspect_ratio, resolution)

    def _resolve_sensenova_size(self, aspect_ratio: str, resolution: str = '2K') -> str:
        """Map aspect ratio/resolution to a size accepted by SenseNova U1."""
        if self._is_sensenova_fixed_size_model():
            return _SENSENOVA_U1_FAST_SIZE_PRESETS.get(
                aspect_ratio,
                _SENSENOVA_U1_FAST_SIZE_PRESETS['16:9'],
            )

        parts = aspect_ratio.split(':')
        if len(parts) == 2:
            try:
                ratio_w, ratio_h = int(parts[0]), int(parts[1])
            except ValueError:
                ratio_w, ratio_h = 1, 1
        else:
            ratio_w, ratio_h = 1, 1
        if ratio_w <= 0 or ratio_h <= 0:
            ratio_w, ratio_h = 1, 1

        long_edge = _SENSENOVA_RESOLUTION_LONG_EDGE.get(
            resolution.upper(),
            _SENSENOVA_RESOLUTION_LONG_EDGE['2K'],
        )
        if ratio_w >= ratio_h:
            width = long_edge
            height = round(width * ratio_h / ratio_w)
            if width > height * _SENSENOVA_IMAGE_MAX_ASPECT:
                height = math.ceil(width / _SENSENOVA_IMAGE_MAX_ASPECT)
        else:
            height = long_edge
            width = round(height * ratio_w / ratio_h)
            if height > width * _SENSENOVA_IMAGE_MAX_ASPECT:
                width = math.ceil(height / _SENSENOVA_IMAGE_MAX_ASPECT)

        def align(value: int) -> int:
            value = max(_SENSENOVA_IMAGE_MIN_EDGE, value)
            value = min(_SENSENOVA_IMAGE_MAX_EDGE, value)
            return max(_SENSENOVA_IMAGE_MIN_EDGE, round(value / _SENSENOVA_IMAGE_ALIGNMENT) * _SENSENOVA_IMAGE_ALIGNMENT)

        def ceil_align(value: int) -> int:
            return max(
                _SENSENOVA_IMAGE_MIN_EDGE,
                math.ceil(value / _SENSENOVA_IMAGE_ALIGNMENT) * _SENSENOVA_IMAGE_ALIGNMENT,
            )

        width, height = align(width), align(height)
        if width > height * _SENSENOVA_IMAGE_MAX_ASPECT:
            height = ceil_align(width / _SENSENOVA_IMAGE_MAX_ASPECT)
        elif height > width * _SENSENOVA_IMAGE_MAX_ASPECT:
            width = ceil_align(height / _SENSENOVA_IMAGE_MAX_ASPECT)
        return f'{width}x{height}'

    def _resolve_seedream_size(self, aspect_ratio: str, resolution: str = '2K') -> str:
        """Map aspect_ratio/resolution to a size accepted by the Seedream images API.

        Seedream 5.0-lite / 4.5 reject explicit sizes below 2560x1440
        (3,686,400 px), so the generic GPT sizing (e.g. 2048x1152 for 16:9 / 2K)
        must not be sent verbatim. Use Volcengine's documented resolution->size
        presets and scale any remaining combination into the model's valid
        total-pixel range while preserving the aspect ratio.
        """
        min_pixels, max_pixels = _seedream_pixel_bounds(self.model)
        tier = resolution.upper()
        if 'pro' in self.model.lower():
            # Seedream 5.0-pro tops out at the 2K tier (max 4,624,220 px).
            tier = '2K'
        presets = _DOUBAO_SEEDREAM_SIZE_PRESETS.get(tier)
        if presets is None and tier == '1K':
            # 1K is below Seedream's smallest tier; the 2K presets are the
            # smallest documented sizes for the strict-range models.
            presets = _DOUBAO_SEEDREAM_SIZE_PRESETS['2K']
        preset = presets.get(aspect_ratio) if presets else None
        if preset:
            return _scale_size_to_pixel_range(preset, min_pixels, max_pixels)
        size = _compute_gpt_image_size(aspect_ratio, resolution)
        return _scale_size_to_pixel_range(size, min_pixels, max_pixels)

    def _resolve_quality(self):
        """Return quality param appropriate for the current model, or None to omit."""
        model = self.model.lower()
        if model == 'dall-e-3':
            return 'standard'   # dall-e-3 only accepts standard / hd
        if model == 'dall-e-2':
            return None          # dall-e-2 has no quality param
        if model.startswith(_DOUBAO_SEEDREAM_PREFIX):
            return None          # Volcengine Seedream does not accept a quality param
        return 'auto'            # gpt-image-* accepts auto / low / medium / high

    def _is_apimart(self) -> bool:
        return "api.apimart.ai" in (self.api_base or "").lower()

    def _apimart_image_urls(self, ref_images: List[Image.Image]) -> List[str]:
        return [
            f"data:image/jpeg;base64,{self._encode_image_to_base64(ref_image)}"
            for ref_image in ref_images
        ]

    def _validate_apimart_reference_images(
        self,
        ref_images: Optional[List[Image.Image]],
    ) -> None:
        if ref_images and len(ref_images) > _MAX_GPT_IMAGE_INPUTS:
            raise ValueError(
                f"{self.model} supports at most {_MAX_GPT_IMAGE_INPUTS} "
                f"reference images, got {len(ref_images)}"
            )

    def _decode_image_response(self, item) -> Image.Image:
        """Extract PIL Image from an images API response item (b64_json, url, or raw string)."""
        if isinstance(item, str):
            return self._decode_raw_string(item)
        b64 = getattr(item, 'b64_json', None)
        if b64:
            return Image.open(BytesIO(base64.b64decode(b64)))
        url = getattr(item, 'url', None)
        if url:
            return self._decode_raw_string(url)
        if isinstance(item, dict):
            if item.get('b64_json'):
                return Image.open(BytesIO(base64.b64decode(item['b64_json'])))
            if item.get('url'):
                return self._decode_raw_string(item['url'])
        raise ValueError("images API returned neither b64_json nor url")

    def _decode_raw_string(self, raw: str) -> Image.Image:
        """Try to decode a raw string as base64 image data, data-URL, or HTTP URL."""
        raw = raw.strip()
        # data:image/...;base64,...
        if raw.startswith('data:image') and ',' in raw:
            b64 = raw.split(',', 1)[1]
            return Image.open(BytesIO(base64.b64decode(b64)))
        # plain HTTP(S) URL
        if raw.startswith(('http://', 'https://')):
            with requests.get(raw, timeout=60, stream=True) as resp:
                resp.raise_for_status()
                return Image.open(BytesIO(resp.content))
        # assume raw base64
        try:
            return Image.open(BytesIO(base64.b64decode(raw)))
        except Exception:
            raise ValueError(f"Cannot decode raw string as image (len={len(raw)}, prefix={raw[:80]!r})")

    def _extract_from_images_result(self, result) -> Image.Image:
        """Defensively extract an image from images.generate / images.edit result.

        Standard OpenAI returns an ImagesResponse with .data[0].
        Proxies (newapi, one-api, etc.) may return strings, dicts, or other shapes.
        """
        # Standard path: result.data exists and is iterable
        data = getattr(result, 'data', None)
        if data is not None:
            try:
                item = data[0]
                return self._decode_image_response(item)
            except (TypeError, IndexError, AttributeError) as exc:
                logger.warning("result.data exists but extraction failed: %s", exc)

        # Proxy returned a plain string (URL or base64)
        if isinstance(result, str):
            logger.info("images API returned raw string, attempting decode")
            return self._decode_raw_string(result)

        # Proxy returned a dict (e.g. {"url": "..."} or {"b64_json": "..."})
        if isinstance(result, dict):
            logger.info("images API returned dict, attempting decode")
            if 'data' in result and isinstance(result['data'], list) and result['data']:
                return self._decode_image_response(result['data'][0])
            return self._decode_image_response(result)

        raise ValueError(f"Unexpected images API response type: {type(result)}")

    @staticmethod
    def _raw_response_payload(raw_response) -> dict:
        json_method = getattr(raw_response, "json", None)
        if callable(json_method):
            return json_method()
        http_response = getattr(raw_response, "http_response", None)
        if http_response is not None and callable(getattr(http_response, "json", None)):
            return http_response.json()
        raise RuntimeError("Unsupported OpenAI raw response type")

    @staticmethod
    def _image_task_id(payload) -> Optional[str]:
        """Return a submitted task id for async image APIs, otherwise None."""
        if not isinstance(payload, dict):
            return None
        data = payload.get("data", payload)
        if isinstance(data, list):
            data = data[0] if data else None
        if not isinstance(data, dict):
            return None
        task_id = data.get("task_id")
        return task_id if isinstance(task_id, str) and task_id else None

    @staticmethod
    def _image_status(payload) -> str:
        if not isinstance(payload, dict):
            return ""
        data = payload.get("data", payload)
        if isinstance(data, list):
            data = data[0] if data else None
        if not isinstance(data, dict):
            return ""
        return str(data.get("status", "")).lower()

    @staticmethod
    def _apimart_error_message(payload) -> str:
        if not isinstance(payload, dict):
            return ""
        data = payload.get("data", payload)
        if isinstance(data, list):
            data = data[0] if data else None
        if not isinstance(data, dict):
            return ""
        return str(data.get("message") or data.get("error") or payload.get("message") or "").strip()

    @staticmethod
    def _apimart_result_image(item) -> str:
        if isinstance(item, str):
            return item
        if isinstance(item, list) and item:
            return OpenAIImageProvider._apimart_result_image(item[0])
        if not isinstance(item, dict):
            raise ValueError("Unexpected apimart task image item")
        url = item.get("url") or item.get("image_url")
        if isinstance(url, list):
            url = url[0] if url else None
        if not isinstance(url, str) or not url:
            raise ValueError("apimart task result image has no URL")
        return url

    def _decode_apimart_task_result(self, payload) -> Image.Image:
        if not isinstance(payload, dict):
            raise ValueError("Invalid apimart task payload")
        data = payload.get("data", payload)
        if not isinstance(data, dict):
            raise ValueError("Invalid apimart task data")
        result = data.get("result", data)
        if not isinstance(result, dict):
            raise ValueError("Invalid apimart task result")
        images = result.get("images")
        if not isinstance(images, list) or not images:
            raise ValueError("apimart task result contains no images")
        return self._decode_image_response(self._apimart_result_image(images[0]))

    def _poll_image_task(self, task_id: str) -> Image.Image:
        endpoint = f"{self.api_base.rstrip('/')}/tasks/{task_id}"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        deadline = time.monotonic() + APIMART_TASK_TIMEOUT

        while True:
            response = requests.get(
                endpoint,
                headers=headers,
                timeout=APIMART_TASK_REQUEST_TIMEOUT,
            )
            response.raise_for_status()
            try:
                payload = response.json()
            except ValueError as exc:
                raise RuntimeError("apimart image task returned invalid JSON") from exc

            if isinstance(payload, dict):
                code = payload.get("code")
                try:
                    code_int = int(code)
                except (TypeError, ValueError):
                    code_int = None
                if code_int not in (None, 200):
                    detail = self._apimart_error_message(payload) or payload.get("message") or str(payload)
                    raise RuntimeError(f"apimart image task failed with code {code}: {detail}")

            status = self._image_status(payload)
            if status in {"completed", "success", "succeeded"}:
                return self._decode_apimart_task_result(payload)
            if status in {"failed", "error", "cancelled", "canceled", "timeout"}:
                detail = self._apimart_error_message(payload) or "unknown error"
                raise RuntimeError(f"apimart image task failed for {task_id}: {detail}")
            if status and status not in {"submitted", "queued", "pending", "processing", "running", "in_progress"}:
                raise RuntimeError(f"apimart image task returned unsupported status for {task_id}: {status}")
            if time.monotonic() >= deadline:
                raise TimeoutError(f"apimart image task timed out after {APIMART_TASK_TIMEOUT:.0f}s")

            logger.debug("apimart image task %s still running (status=%s)", task_id, status or "unknown")
            time.sleep(APIMART_TASK_POLL_INTERVAL)

    def _generate_with_apimart_images_api(
        self,
        prompt: str,
        ref_images: Optional[List[Image.Image]],
        aspect_ratio: str,
        resolution: str,
    ) -> Image.Image:
        extra_body: dict = {"resolution": resolution.lower()}
        if ref_images:
            self._validate_apimart_reference_images(ref_images)
            extra_body["image_urls"] = self._apimart_image_urls(ref_images)

        kwargs = dict(
            model=self.model,
            prompt=prompt,
            n=1,
            size=aspect_ratio,
            extra_body=extra_body,
        )
        logger.debug(
            "Calling APIMart images API for model=%s, size=%s, resolution=%s, refs=%s",
            self.model,
            aspect_ratio,
            resolution,
            len(ref_images) if ref_images else 0,
        )
        raw_response = self.client.images.with_raw_response.generate(**kwargs)
        payload = self._raw_response_payload(raw_response)
        task_id = self._image_task_id(payload)
        if task_id:
            return self._poll_image_task(task_id)
        return self._extract_from_images_result(payload)

    def _generate_with_images_api(
        self,
        prompt: str,
        ref_images: Optional[List[Image.Image]],
        aspect_ratio: str,
        resolution: str = '2K',
    ) -> Optional[Image.Image]:
        """Use the native OpenAI images API (gpt-image-* / dall-e-*)."""
        if self._is_apimart() and self.model.lower() in _GPT_IMAGE_MODELS:
            return self._generate_with_apimart_images_api(
                prompt,
                ref_images,
                aspect_ratio,
                resolution,
            )

        size = self._resolve_size(aspect_ratio, resolution)
        quality = self._resolve_quality()
        # GPT image models always return b64_json; DALL-E models default to url
        is_dalle = self.model.lower() in _DALLE_MODELS
        response_format = 'b64_json' if is_dalle else None

        if ref_images and self.model.lower() != 'dall-e-3':
            # dall-e-3 does not support images.edit; all other native models do
            model = self.model.lower()
            if model == 'dall-e-2':
                # DALL-E 2 accepts only one input image.
                if len(ref_images) > 1:
                    logger.warning(
                        "%s accepts only one reference image; ignoring %d additional image(s)",
                        self.model,
                        len(ref_images) - 1,
                    )
                selected_ref_images = ref_images[:1]
            else:
                # GPT Image accepts multiple inputs. Also preserve all inputs for
                # OpenAI-compatible custom models when the Images API is forced.
                if model in _GPT_IMAGE_MODELS and len(ref_images) > _MAX_GPT_IMAGE_INPUTS:
                    raise ValueError(
                        f"{self.model} supports at most {_MAX_GPT_IMAGE_INPUTS} "
                        f"reference images, got {len(ref_images)}"
                    )
                selected_ref_images = ref_images

            # Resize reference images to match the target size so providers do not
            # reject mismatched dimensions.
            try:
                size_parts = size.split('x') if isinstance(size, str) else ()
                w, h = map(int, size_parts)
                if w <= 0 or h <= 0:
                    raise ValueError("Image edit dimensions must be positive")
            except (TypeError, ValueError):
                logger.warning(
                    "%s resolved an invalid edit size %r; falling back to 1024x1024",
                    self.model,
                    size,
                )
                size = '1024x1024'
                w, h = 1024, 1024
            image_files = []
            for index, ref_img in enumerate(selected_ref_images, start=1):
                prepared_image = ref_img
                if prepared_image.mode != 'RGBA':
                    prepared_image = prepared_image.convert('RGBA')
                if prepared_image.size != (w, h):
                    prepared_image = prepared_image.resize((w, h), Image.LANCZOS)
                image_file = BytesIO(self._pil_to_png_bytes(prepared_image))
                image_file.name = (
                    'image.png'
                    if len(selected_ref_images) == 1
                    else f'image_{index}.png'
                )
                image_files.append(image_file)

            image_input = image_files[0] if len(image_files) == 1 else image_files
            logger.info(
                "%s: images.edit with %d reference image(s), size=%s",
                self.model,
                len(image_files),
                size,
            )
            kwargs = dict(model=self.model, image=image_input, prompt=prompt, n=1, size=size)
            if quality:
                kwargs['quality'] = quality
            if response_format:
                kwargs['response_format'] = response_format
            raw_response = self.client.images.with_raw_response.edit(**kwargs)
        else:
            if ref_images:
                logger.warning("dall-e-3 does not support images.edit; ignoring ref_images")
            logger.debug("%s: images.generate, size=%s, quality=%s", self.model, size, quality)
            kwargs = dict(model=self.model, prompt=prompt, n=1, size=size)
            if quality:
                kwargs['quality'] = quality
            if response_format:
                kwargs['response_format'] = response_format
            raw_response = self.client.images.with_raw_response.generate(**kwargs)

        payload = self._raw_response_payload(raw_response)
        task_id = self._image_task_id(payload)
        if task_id:
            return self._poll_image_task(task_id)

        return self._extract_from_images_result(payload)

    def _generate_with_sensenova_images_api(
        self,
        prompt: str,
        ref_images: Optional[List[Image.Image]],
        aspect_ratio: str,
        resolution: str = '2K',
    ) -> Image.Image:
        """Call SenseNova's native JSON images API."""
        if ref_images and not self._is_sensenova_edit_model():
            raise ValueError(
                f'{self.model} does not support reference-image editing; '
                'use sensenova-u1.5-lite for image edits'
            )
        if ref_images and len(ref_images) > 1:
            # Keep the whole request under SenseNova's file-size limit rather
            # than discovering the rejection after uploading several images.
            per_image_limit = _SENSENOVA_IMAGE_REFERENCE_MAX_BYTES // len(ref_images)
            image_data_urls = [
                self._sensenova_reference_data_url(ref_image, per_image_limit)
                for ref_image in ref_images
            ]
        elif ref_images:
            image_data_urls = [
                self._sensenova_reference_data_url(ref_image)
                for ref_image in ref_images
            ]
        else:
            image_data_urls = []

        endpoint = 'images/edits' if ref_images else 'images/generations'
        payload = {
            'model': self.model,
            'prompt': prompt,
            'n': 1,
            'watermark': False,
            'prompt_extend': True,
            'response_format': 'url',
            'output_format': 'png',
        }
        if ref_images:
            payload['images'] = [
                {'image_url': image_data_url}
                for image_data_url in image_data_urls
            ]
        size = self._resolve_size(aspect_ratio, resolution)
        if size and size != 'auto':
            payload['size'] = size

        url = f"{self.api_base.rstrip('/')}/{endpoint}"
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
        }
        try:
            response = self._post_sensenova_with_retry(url, headers, payload)
        except requests.exceptions.HTTPError as exc:
            response = exc.response
            if response is None:
                raise RuntimeError('SenseNova image API request failed') from exc
            try:
                result = response.json()
            except ValueError as json_exc:
                raise RuntimeError(
                    f'SenseNova image API returned invalid JSON (HTTP {response.status_code})'
                ) from json_exc
            error = result.get('error', result) if isinstance(result, dict) else result
            message = error.get('message') if isinstance(error, dict) else error
            raise RuntimeError(
                f'SenseNova image API error (HTTP {response.status_code}): {message}'
            ) from exc
        try:
            result = response.json()
        except ValueError as exc:
            raise RuntimeError(
                f'SenseNova image API returned invalid JSON (HTTP {response.status_code})'
            ) from exc
        if response.status_code >= 400:
            error = result.get('error', result) if isinstance(result, dict) else result
            message = error.get('message') if isinstance(error, dict) else error
            raise RuntimeError(
                f'SenseNova image API error (HTTP {response.status_code}): {message}'
            )
        data = result.get('data') if isinstance(result, dict) else None
        if not isinstance(data, list) or not data:
            raise RuntimeError('SenseNova image API returned no image data')
        return self._decode_image_response(data[0])

    def generate_image(
        self,
        prompt: str,
        ref_images: Optional[List[Image.Image]] = None,
        aspect_ratio: str = "16:9",
        resolution: str = "2K",
        enable_thinking: bool = False,
        thinking_budget: int = 0
    ) -> Optional[Image.Image]:
        """
        Generate image using OpenAI SDK
        
        Supports resolution control via extra_body parameters for compatible providers.
        Note: Not all providers support 2K/4K resolution - some may return 1K regardless.
        Note: enable_thinking and thinking_budget are ignored (OpenAI format doesn't support thinking mode)
        
        The provider will:
        1. Try to use extra_body parameters (API易/AvalAI style) for resolution control
        2. Use system message for aspect_ratio as fallback
        
        Args:
            prompt: The image generation prompt
            ref_images: Optional list of reference images
            aspect_ratio: Image aspect ratio
            resolution: Image resolution ("1K", "2K", "4K") - support depends on provider
            enable_thinking: Ignored, kept for interface compatibility
            thinking_budget: Ignored, kept for interface compatibility
            
        Returns:
            Generated PIL Image object, or None if failed
        """
        if self._is_apimart() and self.model.lower() in _GPT_IMAGE_MODELS:
            self._validate_apimart_reference_images(ref_images)
        try:
            # SenseNova U1 image models expose a JSON API, not the OpenAI SDK's
            # multipart images.edit request. Route them before the generic paths.
            if self._is_sensenova_image_model():
                return self._generate_with_sensenova_images_api(
                    prompt,
                    ref_images,
                    aspect_ratio,
                    resolution,
                )

            # Route based on image_api_protocol setting
            # Doubao Seedream keeps the chat-completions path when reference images are
            # present: the images.edit endpoint is only for SeedEdit models, while the
            # legacy chat path still accepts inline base64 references. This exemption
            # overrides even a forced 'images' protocol: applying the Agent Plans
            # recommended models sets openai_image_api_protocol=images, and Seedream
            # with references must still avoid images.edit.
            is_seedream_with_references = (
                bool(ref_images)
                and self.model.lower().startswith(_DOUBAO_SEEDREAM_PREFIX)
            )
            use_images_api = (
                not is_seedream_with_references
                and (
                    self.image_api_protocol == 'images'
                    or (
                        self.image_api_protocol == 'auto'
                        and self._is_native_images_api_model()
                    )
                )
            )
            if use_images_api:
                return self._generate_with_images_api(prompt, ref_images, aspect_ratio, resolution)

            # Build message content
            content = []
            
            # Add reference images first (if any)
            if ref_images:
                for ref_img in ref_images:
                    base64_image = self._encode_image_to_base64(ref_img)
                    content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    })
            
            # Add text prompt
            content.append({"type": "text", "text": prompt})
            
            logger.debug(f"Calling OpenAI API for image generation with {len(ref_images) if ref_images else 0} reference images...")
            logger.debug(f"Config - aspect_ratio: {aspect_ratio}, resolution: {resolution}")
            
            # Build extra_body with resolution parameters for compatible providers
            extra_body = self._build_extra_body(aspect_ratio, resolution)
            extra_body["modalities"] = ["text", "image"]
            logger.debug(f"Using extra_body: {extra_body}")

            # Use both system message (for basic providers) and extra_body (for advanced providers)
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": f"aspect_ratio={aspect_ratio}, resolution={resolution}"},
                    {"role": "user", "content": content},
                ],
                modalities=["text", "image"],
                extra_body=extra_body,
                stream=False,
            )
            
            logger.debug("OpenAI API call completed")
            
            # Extract image from response - handle different response formats
            message = response.choices[0].message

            # Debug: log available attributes
            logger.debug(f"Response message attributes: {dir(message)}")

            # Try message.images first (OpenRouter format)
            images_attr = getattr(message, 'images', None)
            if images_attr:
                for img_item in images_attr:
                    url = None
                    if isinstance(img_item, dict):
                        url = img_item.get('image_url', {}).get('url', '')
                    elif hasattr(img_item, 'image_url'):
                        iu = img_item.image_url
                        url = iu.get('url', '') if isinstance(iu, dict) else getattr(iu, 'url', '')
                    if url and url.startswith('data:image'):
                        base64_data = url.split(',', 1)[1]
                        image = Image.open(BytesIO(base64.b64decode(base64_data)))
                        logger.debug(f"Extracted image from message.images: {image.size}")
                        return image

            # Try multi_mod_content (custom format from some proxies)
            if hasattr(message, 'multi_mod_content') and message.multi_mod_content:
                parts = message.multi_mod_content
                for part in parts:
                    if "text" in part:
                        logger.debug(f"Response text: {part['text'][:100] if len(part['text']) > 100 else part['text']}")
                    if "inline_data" in part:
                        image_data = base64.b64decode(part["inline_data"]["data"])
                        image = Image.open(BytesIO(image_data))
                        logger.debug(f"Successfully extracted image: {image.size}, {image.mode}")
                        return image
            
            # Try standard OpenAI content format (list of content parts)
            if hasattr(message, 'content') and message.content:
                # If content is a list (multimodal response)
                if isinstance(message.content, list):
                    for part in message.content:
                        if isinstance(part, dict):
                            # Handle image_url type
                            if part.get('type') == 'image_url':
                                image_url = part.get('image_url', {}).get('url', '')
                                if image_url.startswith('data:image'):
                                    # Extract base64 data from data URL
                                    base64_data = image_url.split(',', 1)[1]
                                    image_data = base64.b64decode(base64_data)
                                    image = Image.open(BytesIO(image_data))
                                    logger.debug(f"Successfully extracted image from content: {image.size}, {image.mode}")
                                    return image
                            # Handle text type
                            elif part.get('type') == 'text':
                                text = part.get('text', '')
                                if text:
                                    logger.debug(f"Response text: {text[:100] if len(text) > 100 else text}")
                        elif hasattr(part, 'type'):
                            # Handle as object with attributes
                            if part.type == 'image_url':
                                image_url = getattr(part, 'image_url', {})
                                if isinstance(image_url, dict):
                                    url = image_url.get('url', '')
                                else:
                                    url = getattr(image_url, 'url', '')
                                if url.startswith('data:image'):
                                    base64_data = url.split(',', 1)[1]
                                    image_data = base64.b64decode(base64_data)
                                    image = Image.open(BytesIO(image_data))
                                    logger.debug(f"Successfully extracted image from content object: {image.size}, {image.mode}")
                                    return image
                # If content is a string, try to extract image from it
                elif isinstance(message.content, str):
                    content_str = message.content
                    logger.debug(f"Response content (string): {content_str[:200] if len(content_str) > 200 else content_str}")
                    
                    # Try to extract Markdown image URL: ![...](url)
                    markdown_pattern = r'!\[.*?\]\((https?://[^\s\)]+)\)'
                    markdown_matches = re.findall(markdown_pattern, content_str)
                    if markdown_matches:
                        image_url = markdown_matches[0]  # Use the first image URL found
                        logger.debug(f"Found Markdown image URL: {image_url}")
                        try:
                            response = requests.get(image_url, timeout=30, stream=True)
                            response.raise_for_status()
                            image = Image.open(BytesIO(response.content))
                            image.load()  # Ensure image is fully loaded
                            logger.debug(f"Successfully downloaded image from Markdown URL: {image.size}, {image.mode}")
                            return image
                        except Exception as download_error:
                            logger.warning(f"Failed to download image from Markdown URL: {download_error}")
                    
                    # Try to extract plain URL (not in Markdown format)
                    url_pattern = r'(https?://[^\s\)\]]+\.(?:png|jpg|jpeg|gif|webp|bmp)(?:\?[^\s\)\]]*)?)'
                    url_matches = re.findall(url_pattern, content_str, re.IGNORECASE)
                    if url_matches:
                        image_url = url_matches[0]
                        logger.debug(f"Found plain image URL: {image_url}")
                        try:
                            response = requests.get(image_url, timeout=30, stream=True)
                            response.raise_for_status()
                            image = Image.open(BytesIO(response.content))
                            image.load()
                            logger.debug(f"Successfully downloaded image from plain URL: {image.size}, {image.mode}")
                            return image
                        except Exception as download_error:
                            logger.warning(f"Failed to download image from plain URL: {download_error}")
                    
                    # Try to extract base64 data URL from string
                    base64_pattern = r'data:image/[^;]+;base64,([A-Za-z0-9+/=]+)'
                    base64_matches = re.findall(base64_pattern, content_str)
                    if base64_matches:
                        base64_data = base64_matches[0]
                        logger.debug(f"Found base64 image data in string")
                        try:
                            image_data = base64.b64decode(base64_data)
                            image = Image.open(BytesIO(image_data))
                            logger.debug(f"Successfully extracted base64 image from string: {image.size}, {image.mode}")
                            return image
                        except Exception as decode_error:
                            logger.warning(f"Failed to decode base64 image from string: {decode_error}")
            
            # Log raw response for debugging
            logger.warning(f"Unable to extract image. Raw message type: {type(message)}")
            logger.warning(f"Message content type: {type(getattr(message, 'content', None))}")
            raw = str(getattr(message, 'content', 'N/A'))
            logger.warning(f"Message content: {raw[:300]}{'...(truncated)' if len(raw) > 300 else ''}")
            logger.warning(f"Message all attrs: {vars(message) if hasattr(message, '__dict__') else dir(message)}"[:500])
            
            raise ValueError("No valid multimodal response received from OpenAI API")
            
        except Exception as e:
            error_detail = f"Error generating image with OpenAI (model={self.model}): {type(e).__name__}: {str(e)}"
            logger.error(error_detail, exc_info=True)
            raise Exception(error_detail) from e
