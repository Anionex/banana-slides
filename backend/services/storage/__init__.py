"""Storage service factory with runtime-configurable backends."""
from __future__ import annotations

import logging
import os
from typing import Optional

from services.provider_config import get_storage_runtime_settings

from .base import StorageBackend
from .local import LocalStorage
from .oss import AliyunOSSStorage
from .r2 import R2Storage

logger = logging.getLogger(__name__)

_storage_instance: Optional[StorageBackend] = None


def _create_storage_from_runtime(runtime: dict) -> StorageBackend:
    backend_type = (runtime.get('backend') or 'local').lower()
    providers = runtime.get('providers') or {}

    if backend_type == 'local':
        upload_folder = (providers.get('local') or {}).get('upload_folder') or os.environ.get('UPLOAD_FOLDER', 'uploads')
        storage = LocalStorage(upload_folder)
        logger.info('Storage backend initialized: LocalStorage at %s', upload_folder)
        return storage

    if backend_type in {'r2', 's3'}:
        cfg = providers.get('r2') or {}
        storage = R2Storage(
            bucket=cfg.get('bucket', ''),
            account_id=cfg.get('account_id', ''),
            access_key_id=cfg.get('access_key_id', ''),
            secret_access_key=cfg.get('secret_access_key', ''),
            public_base_url=cfg.get('public_base_url', ''),
            region=cfg.get('region', 'auto'),
            endpoint_url=cfg.get('endpoint_url', ''),
            signed_url_ttl=int(cfg.get('signed_url_ttl', 3600)),
        )
        logger.info('Storage backend initialized: R2Storage bucket=%s', cfg.get('bucket', ''))
        return storage

    if backend_type == 'oss':
        cfg = providers.get('oss') or {}
        storage = AliyunOSSStorage(
            bucket=cfg.get('bucket', ''),
            endpoint=cfg.get('endpoint', ''),
            access_key_id=cfg.get('access_key_id', ''),
            access_key_secret=cfg.get('access_key_secret', ''),
            public_base_url=cfg.get('public_base_url', ''),
            signed_url_ttl=int(cfg.get('signed_url_ttl', 3600)),
        )
        logger.info('Storage backend initialized: AliyunOSSStorage bucket=%s', cfg.get('bucket', ''))
        return storage

    raise ValueError(f'Unknown storage backend: {backend_type}')


def get_storage() -> StorageBackend:
    global _storage_instance
    if _storage_instance is None:
        runtime = get_storage_runtime_settings()
        _storage_instance = _create_storage_from_runtime(runtime)
    return _storage_instance


def init_storage(app) -> StorageBackend:
    global _storage_instance
    runtime = get_storage_runtime_settings()
    _storage_instance = _create_storage_from_runtime(runtime)
    app.config['STORAGE_BACKEND'] = runtime.get('backend', 'local')
    return _storage_instance


def reset_storage() -> None:
    global _storage_instance
    _storage_instance = None


__all__ = [
    'StorageBackend',
    'LocalStorage',
    'R2Storage',
    'AliyunOSSStorage',
    'get_storage',
    'init_storage',
    'reset_storage',
]
