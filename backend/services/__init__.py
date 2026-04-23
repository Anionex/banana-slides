"""Services package with lazy exports.

Avoid importing heavyweight provider stacks at package-import time so small helper
modules (for example storage backends or smoke tests) can be imported without
pulling in every AI/payment dependency.
"""
from __future__ import annotations

from importlib import import_module
from typing import Any

__all__ = [
    'AIService', 'ProjectContext', 'FileService', 'ExportService',
    'get_storage', 'StorageBackend', 'LocalStorage', 'AliyunOSSStorage', 'R2Storage', 'init_storage',
    'get_queue', 'TaskQueue', 'ThreadPoolQueue', 'init_queue',
]


def __getattr__(name: str) -> Any:
    if name in {'AIService', 'ProjectContext'}:
        module = import_module('.ai_service', __name__)
        return getattr(module, name)
    if name == 'FileService':
        module = import_module('.file_service', __name__)
        return getattr(module, name)
    if name == 'ExportService':
        module = import_module('.export_service', __name__)
        return getattr(module, name)
    if name in {'get_storage', 'StorageBackend', 'LocalStorage', 'AliyunOSSStorage', 'R2Storage', 'init_storage'}:
        module = import_module('.storage', __name__)
        return getattr(module, name)
    if name in {'get_queue', 'TaskQueue', 'ThreadPoolQueue', 'init_queue'}:
        module = import_module('.queue', __name__)
        return getattr(module, name)
    raise AttributeError(f'module {__name__!r} has no attribute {name!r}')
