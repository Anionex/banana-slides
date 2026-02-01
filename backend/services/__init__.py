"""Services package"""
from .ai_service import AIService, ProjectContext
from .file_service import FileService
from .export_service import ExportService

# 存储和队列抽象层
from .storage import get_storage, StorageBackend, LocalStorage, init_storage
from .queue import get_queue, TaskQueue, ThreadPoolQueue, init_queue

__all__ = [
    'AIService', 'ProjectContext', 'FileService', 'ExportService',
    # Storage
    'get_storage', 'StorageBackend', 'LocalStorage', 'init_storage',
    # Queue
    'get_queue', 'TaskQueue', 'ThreadPoolQueue', 'init_queue',
]

