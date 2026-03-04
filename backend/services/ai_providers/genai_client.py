"""Shared GenAI client factory used by both text and image providers."""

import logging
from google import genai
from google.genai import types
from config import get_config

logger = logging.getLogger(__name__)


def _sanitize_string(value: str) -> str:
    """Remove non-ASCII characters that can cause encoding errors in API calls."""
    if value is None:
        return None
    return value.encode('ascii', errors='ignore').decode('ascii').strip()


def make_genai_client(
    *,
    vertexai: bool,
    api_key: str = None,
    api_base: str = None,
    project_id: str = None,
    location: str = None,
) -> genai.Client:
    """Construct a ``genai.Client`` for either AI Studio or Vertex AI."""
    timeout_ms = int(get_config().GENAI_TIMEOUT * 1000)

    # Sanitize string parameters to avoid ASCII encoding errors
    api_key = _sanitize_string(api_key) if api_key else None
    api_base = _sanitize_string(api_base) if api_base else None
    project_id = _sanitize_string(project_id) if project_id else None
    location = _sanitize_string(location) if location else None

    if vertexai:
        logger.info("Creating GenAI client (Vertex AI) — project=%s, location=%s", project_id, location)
        return genai.Client(
            vertexai=True,
            project=project_id,
            location=location or "us-central1",
            http_options=types.HttpOptions(timeout=timeout_ms),
        )

    opts = types.HttpOptions(timeout=timeout_ms, base_url=api_base)
    return genai.Client(http_options=opts, api_key=api_key)
