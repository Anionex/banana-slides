"""
Aggregated image provider with multi-channel fallback and circuit breaker
"""
import time
import logging
from typing import Optional, List, Dict
from PIL import Image
from .base import ImageProvider
from .genai_provider import GenAIImageProvider
from .openai_provider import OpenAIImageProvider

logger = logging.getLogger(__name__)

# Module-level circuit breaker state
_circuit_state: Dict[str, dict] = {}
FAILURE_THRESHOLD = 3
COOLDOWN_SECONDS = 120


def _is_channel_open(channel_id: str) -> bool:
    state = _circuit_state.get(channel_id)
    if not state:
        return True
    if state['failures'] >= FAILURE_THRESHOLD:
        if time.time() < state['disabled_until']:
            return False
        # Cooldown expired, allow retry
        state['failures'] = 0
    return True


def _record_failure(channel_id: str):
    state = _circuit_state.setdefault(channel_id, {'failures': 0, 'disabled_until': 0})
    state['failures'] += 1
    if state['failures'] >= FAILURE_THRESHOLD:
        state['disabled_until'] = time.time() + COOLDOWN_SECONDS
        logger.warning(f"Channel {channel_id} circuit opened after {FAILURE_THRESHOLD} failures, cooldown {COOLDOWN_SECONDS}s")


def _record_success(channel_id: str):
    if channel_id in _circuit_state:
        _circuit_state[channel_id] = {'failures': 0, 'disabled_until': 0}


def _create_provider(channel: dict) -> ImageProvider:
    fmt = channel.get('provider_format', 'gemini')
    api_key = channel.get('api_key', '')
    api_base = channel.get('api_base', '')
    model = channel.get('model', 'gemini-3-pro-image-preview')
    if fmt == 'openai':
        return OpenAIImageProvider(api_key=api_key, api_base=api_base or None, model=model)
    return GenAIImageProvider(api_key=api_key, api_base=api_base or None, model=model)


class AggregatedImageProvider(ImageProvider):
    """Routes image generation across multiple channels with fallback"""

    def __init__(self, channels: List[dict]):
        self.channels = sorted(
            [c for c in channels if c.get('enabled', True)],
            key=lambda c: c.get('priority', 999)
        )

    def generate_image(
        self,
        prompt: str,
        ref_images: Optional[List[Image.Image]] = None,
        aspect_ratio: str = "16:9",
        resolution: str = "2K",
        enable_thinking: bool = False,
        thinking_budget: int = 0
    ) -> Optional[Image.Image]:
        last_error = None
        for ch in self.channels:
            cid = ch.get('id', ch.get('name', 'unknown'))
            if not _is_channel_open(cid):
                logger.info(f"Skipping channel {cid} (circuit open)")
                continue
            try:
                provider = _create_provider(ch)
                result = provider.generate_image(
                    prompt=prompt, ref_images=ref_images,
                    aspect_ratio=aspect_ratio, resolution=resolution,
                    enable_thinking=enable_thinking, thinking_budget=thinking_budget
                )
                if result is not None:
                    _record_success(cid)
                    return result
                _record_failure(cid)
                last_error = Exception(f"Channel {cid} returned None")
            except Exception as e:
                logger.error(f"Channel {cid} failed: {type(e).__name__}")
                _record_failure(cid)
                last_error = e
        if last_error:
            raise last_error
        raise RuntimeError("No available image provider channels")
