"""Centralized file URL generation.

Priority: CDN_BASE_URL env var > SystemConfig.cdn_base_url > /files/... proxy
"""
import os
import logging

logger = logging.getLogger(__name__)

_cdn_base_url: str | None = None
_initialized = False


def _ensure_init():
    global _cdn_base_url, _initialized
    if not _initialized:
        url = os.environ.get('CDN_BASE_URL', '').rstrip('/')
        if not url:
            try:
                from models import SystemConfig
                config = SystemConfig.query.get(1)
                if config and config.cdn_base_url:
                    url = config.cdn_base_url.rstrip('/')
            except Exception:
                pass
        _cdn_base_url = url if url else None
        _initialized = True


def file_url(relative_path: str) -> str:
    _ensure_init()
    normalized = relative_path.replace('\\', '/').lstrip('/')
    if _cdn_base_url:
        return f"{_cdn_base_url}/{normalized}"
    return f"/files/{normalized}"


def reset_file_url():
    global _initialized
    _initialized = False
