"""Shared GenAI client factory used by both text and image providers."""

import logging
from google import genai
from google.genai import types
from config import get_config

logger = logging.getLogger(__name__)


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
