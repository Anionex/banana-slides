"""
OpenAI SDK implementation for text generation
"""
import base64
import logging
from time import monotonic
from typing import Generator
from openai import OpenAI
from .base import TextProvider, strip_think_tags
from .stream_control import stream_timeout, stream_stopped
from config import get_config

logger = logging.getLogger(__name__)


class OpenAITextProvider(TextProvider):
    """Text generation using OpenAI SDK (compatible with Gemini via proxy)"""
    
    def __init__(self, api_key: str, api_base: str = None, model: str = "gemini-3-flash-preview", *, provider_format: str = 'openai'):
        """
        Initialize OpenAI text provider
        
        Args:
            api_key: API key
            api_base: API base URL (e.g., https://api.inferera.com/v1)
            model: Model name to use
        """
        config = get_config()
        self.client = OpenAI(
            api_key=api_key,
            base_url=api_base,
            timeout=config.OPENAI_TIMEOUT,  # set timeout from config
            max_retries=config.OPENAI_MAX_RETRIES  # set max retries from config
        )
        self.model = model
        self.provider_format = provider_format
        self.request_timeout_seconds = config.OPENAI_TIMEOUT
        self.max_attempts = config.OPENAI_MAX_RETRIES + 1

    def _thinking_options(self, thinking_budget: int):
        # Explicit capability for the public site's existing Ark model. Do not
        # send vendor-only fields to arbitrary OpenAI-compatible endpoints.
        if self.provider_format == 'volcengine' and self.model in (
            'doubao-seed-2.1-turbo', 'doubao-seed-2-1-turbo-260628',
        ) and thinking_budget >= 0:
            return {'extra_body': {'thinking': {
                'type': 'enabled' if thinking_budget > 0 else 'disabled',
            }}}
        return {}
    
    def generate_text(self, prompt: str, thinking_budget: int = 0) -> str:
        """
        Generate text using OpenAI SDK
        
        Args:
            prompt: The input prompt
            thinking_budget: Not used in OpenAI format, kept for interface compatibility (0 = default)
            
        Returns:
            Generated text
        """
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "user", "content": prompt}
            ],
            stream=False,
            **self._thinking_options(thinking_budget),
        )
        return strip_think_tags(response.choices[0].message.content)

    def generate_text_stream(self, prompt: str, thinking_budget: int = 0) -> Generator[str, None, None]:
        """Stream text using OpenAI SDK with stream=True."""
        timeout = stream_timeout()
        client = self.client if timeout is None else self.client.with_options(
            timeout=min(timeout, self.request_timeout_seconds), max_retries=0,
        )
        started = monotonic()
        first_chunk = first_text = None
        text_chars = reasoning_chars = 0
        response = None
        request_id = None
        try:
            response = client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                stream=True,
                **self._thinking_options(thinking_budget),
            )
            request_id = getattr(response, '_request_id', None)
            for chunk in response:
                if stream_stopped():
                    break
                if first_chunk is None:
                    first_chunk = round(monotonic() - started, 3)
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta:
                    reasoning_chars += len(getattr(delta, 'reasoning_content', None) or '')
                if delta and delta.content:
                    if first_text is None:
                        first_text = round(monotonic() - started, 3)
                    text_chars += len(delta.content)
                    yield delta.content
        finally:
            if response is not None:
                response.close()
            logger.info(
                'Text stream timing model=%s request_id=%s first_chunk_s=%s '
                'first_text_s=%s elapsed_s=%.3f text_chars=%d reasoning_chars=%d stopped=%s',
                self.model, request_id, first_chunk, first_text,
                monotonic() - started, text_chars, reasoning_chars, stream_stopped(),
            )

    def generate_with_image(self, prompt: str, image_path: str, thinking_budget: int = 0) -> str:
        """Generate text with image input using OpenAI-compatible chat completions."""
        with open(image_path, "rb") as image_file:
            encoded = base64.b64encode(image_file.read()).decode("ascii")

        response = self.client.chat.completions.create(
            model=self.model,
            **self._thinking_options(thinking_budget),
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{encoded}"},
                        },
                    ],
                }
            ],
            stream=False,
        )

        message_content = response.choices[0].message.content
        if isinstance(message_content, str):
            return strip_think_tags(message_content)

        parts = []
        for item in message_content or []:
            text = item.get("text") if isinstance(item, dict) else getattr(item, "text", None)
            if text:
                parts.append(text)
        return strip_think_tags("\n".join(parts))
