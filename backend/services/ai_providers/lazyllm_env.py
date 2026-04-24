"""Utilities for resolving LazyLLM API keys from vendor-prefixed env vars."""
import json
import os

ALLOWED_LAZYLLM_VENDORS = frozenset({
    'qwen', 'doubao', 'deepseek', 'glm', 'siliconflow',
    'sensenova', 'minimax', 'openai', 'kimi',
})


def collect_env_lazyllm_api_keys() -> str | None:
    """Scan env vars for {VENDOR}_API_KEY and return JSON string, or None."""
    keys = {}
    for vendor in ALLOWED_LAZYLLM_VENDORS:
        val = os.getenv(f"{vendor.upper()}_API_KEY", "")
        if val:
            keys[vendor] = val
    return json.dumps(keys) if keys else None


def get_lazyllm_api_key(source: str, namespace: str = "BANANA", explicit_keys: dict | None = None) -> str:
    """
    Resolve API key for a LazyLLM source from vendor-prefixed key only.

    Expected format: {SOURCE}_API_KEY, e.g. QWEN_API_KEY.
    """
    source_upper = (source or "").upper()
    if not source_upper:
        return ""
    source_lower = source.lower()
    if explicit_keys and explicit_keys.get(source_lower):
        return explicit_keys[source_lower]

    namespaced_key = os.getenv(f"{namespace}_{source_upper}_API_KEY", "")
    if namespaced_key:
        return namespaced_key

    return os.getenv(f"{source_upper}_API_KEY", "")


def ensure_lazyllm_namespace_key(
    source: str,
    namespace: str = "BANANA",
    api_key: str | None = None,
    explicit_keys: dict | None = None,
) -> bool:
    """
    Ensure LazyLLM namespace key exists by mapping from vendor-prefixed key.
    """
    source_upper = (source or "").upper()
    if not source_upper:
        return False

    namespace_key = f"{namespace}_{source_upper}_API_KEY"
    resolved_key = api_key or get_lazyllm_api_key(
        source,
        namespace=namespace,
        explicit_keys=explicit_keys,
    )
    if resolved_key:
        os.environ[namespace_key] = resolved_key
        return True
    return False
