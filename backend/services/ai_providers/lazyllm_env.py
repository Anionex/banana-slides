"""Utilities for resolving LazyLLM API keys from vendor-prefixed env vars."""
import os


def get_lazyllm_api_key(source: str, namespace: str = "BANANA") -> str:
    """
    Resolve API key for a LazyLLM source from vendor-prefixed key only.

    Expected format: {SOURCE}_API_KEY, e.g. QWEN_API_KEY.
    """
    source_upper = (source or "").upper()
    if not source_upper:
        return ""
    return os.getenv(f"{source_upper}_API_KEY", "")


def ensure_lazyllm_namespace_key(source: str, namespace: str = "BANANA") -> bool:
    """
    Ensure LazyLLM namespace key exists by mapping from vendor-prefixed key.
    """
    source_upper = (source or "").upper()
    if not source_upper:
        return False

    namespace_key = f"{namespace}_{source_upper}_API_KEY"
    resolved_key = get_lazyllm_api_key(source, namespace=namespace)
    if resolved_key:
        os.environ[namespace_key] = resolved_key
        return True
    return False
