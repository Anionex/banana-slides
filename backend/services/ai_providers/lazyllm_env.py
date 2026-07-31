"""Utilities for resolving LazyLLM API keys and online suppliers."""
import importlib
import json
import logging
import os

logger = logging.getLogger(__name__)

ALLOWED_LAZYLLM_VENDORS = frozenset({
    'qwen', 'doubao', 'deepseek', 'glm', 'siliconflow',
    'sensenova', 'minimax', 'openai', 'kimi', 'ppio', 'aiping',
})

# LazyLLM auto-discovers these in
# ``lazyllm.module.llms.onlinemodule.supplier`` via ``pkgutil.iter_modules``,
# which can silently return nothing in PyInstaller-frozen builds. Keep the
# list in sync with the supplier directory of the supported LazyLLM versions
# (verified against 0.7.5) so registration works deterministically everywhere.
LAZYLLM_SUPPLIER_MODULES = (
    'aiping', 'deepseek', 'doubao', 'glm', 'kimi', 'minimax',
    'openai', 'ppio', 'qwen', 'sensenova', 'siliconflow',
)


def ensure_lazyllm_suppliers() -> list:
    """Import every LazyLLM online supplier so the vendor registry is complete.

    LazyLLM registers suppliers when their modules are imported.  Its
    ``supplier/__init__.py`` discovers them with ``pkgutil.iter_modules``,
    which is unreliable inside PyInstaller-frozen executables (PYZ modules are
    not visible as filesystem entries).  Importing each known supplier module
    explicitly makes registration deterministic in both normal and frozen
    runtimes.  Vendor SDKs may be missing, so failures are logged per supplier
    instead of aborting the loop.

    Returns the names of suppliers that were imported successfully.
    """
    try:
        from lazyllm.module.llms import onlinemodule  # noqa: F401
        import lazyllm.module.llms.onlinemodule.supplier as supplier_pkg
    except ModuleNotFoundError:
        return []

    imported = []
    for name in LAZYLLM_SUPPLIER_MODULES:
        try:
            importlib.import_module(f'{supplier_pkg.__name__}.{name}')
            imported.append(name)
        except Exception as exc:  # noqa: BLE001 - keep other suppliers usable
            logger.warning('Failed to import LazyLLM supplier %s: %s', name, exc)
    return imported


def resolve_lazyllm_source(source: str, registry_name: str = 'chat') -> str:
    """Resolve a user-facing vendor name to a registered LazyLLM source.

    LazyLLM registers concrete classes under derived keys (e.g. ``QwenChat``
    becomes ``qwenchat``) and normally accepts the bare vendor name through its
    fuzzy ``LazyDict`` matching.  This helper validates the source against the
    current runtime registry and raises a descriptive error (including the
    registered sources) when it is missing, instead of the opaque
    ``Unsupported source: ...`` assertion from deep inside LazyLLM.

    Returns the source unchanged when it resolves.
    """
    import lazyllm

    registry = getattr(lazyllm.online, registry_name, None)
    if registry is None:
        raise ValueError(
            f'LazyLLM registry {registry_name!r} is unavailable; '
            'the lazyllm package may be incomplete or not installed.'
        )
    if source in registry:
        return source
    # Explicit fallback for registries whose keys are the concrete class names
    # (e.g. ``qwenchat`` for chat, ``qwentext2image`` for image editing) and
    # which do not perform LazyLLM's fuzzy matching themselves.
    suffix = registry_name.lower()
    if any(key == f'{source}{suffix}' for key in registry.keys()):
        return source
    # Tolerate registries that are empty or not dict-like (unit-test mocks,
    # partially broken installs): keep the configured source and let LazyLLM
    # produce its own error instead of crashing during provider construction.
    try:
        registered = list(registry.keys())
    except TypeError:
        registered = None
    if not registered:
        return source
    raise ValueError(
        f"LazyLLM source {source!r} is not registered for {registry_name}. "
        f'Available sources: {sorted(registry.keys())}'
    )


def collect_env_lazyllm_api_keys() -> str | None:
    """Scan env vars for {VENDOR}_API_KEY and return JSON string, or None."""
    keys = {}
    for vendor in ALLOWED_LAZYLLM_VENDORS:
        val = os.getenv(f"{vendor.upper()}_API_KEY", "")
        if val:
            keys[vendor] = val
    return json.dumps(keys) if keys else None


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
