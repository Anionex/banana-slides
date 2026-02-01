"""
Storage Service Package

提供存储抽象层，支持本地存储和云存储的无缝切换。

使用方法:
    from services.storage import get_storage
    
    storage = get_storage()
    storage.save_image(image, "project_id/pages/image.png")
"""
import os
import logging
from typing import Optional
from functools import lru_cache

from .base import StorageBackend
from .local import LocalStorage

logger = logging.getLogger(__name__)

# 全局存储实例缓存
_storage_instance: Optional[StorageBackend] = None


def get_storage() -> StorageBackend:
    """
    获取存储后端实例（工厂函数）
    
    根据环境变量 STORAGE_BACKEND 决定使用哪种存储后端：
    - local: 本地文件系统（默认）
    - s3: Amazon S3（未来实现）
    - oss: 阿里云 OSS（未来实现）
    
    Returns:
        StorageBackend 实例
    
    Example:
        storage = get_storage()
        storage.save_image(image, "project/pages/1.png")
    """
    global _storage_instance
    
    if _storage_instance is not None:
        return _storage_instance
    
    backend_type = os.environ.get('STORAGE_BACKEND', 'local').lower()
    
    if backend_type == 'local':
        # 获取上传目录配置
        upload_folder = os.environ.get('UPLOAD_FOLDER', 'uploads')
        _storage_instance = LocalStorage(upload_folder)
        logger.info(f"Storage backend initialized: LocalStorage at {upload_folder}")
    
    elif backend_type == 's3':
        # TODO: 实现 S3 存储后端
        # from .s3 import S3Storage
        # _storage_instance = S3Storage(
        #     bucket=os.environ.get('S3_BUCKET'),
        #     region=os.environ.get('S3_REGION'),
        #     access_key=os.environ.get('AWS_ACCESS_KEY_ID'),
        #     secret_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
        # )
        raise NotImplementedError("S3 storage backend not yet implemented")
    
    elif backend_type == 'oss':
        # TODO: 实现阿里云 OSS 存储后端
        raise NotImplementedError("OSS storage backend not yet implemented")
    
    else:
        raise ValueError(f"Unknown storage backend: {backend_type}")
    
    return _storage_instance


def init_storage(app) -> StorageBackend:
    """
    使用 Flask app 配置初始化存储
    
    Args:
        app: Flask application instance
        
    Returns:
        StorageBackend 实例
    """
    global _storage_instance
    
    backend_type = app.config.get('STORAGE_BACKEND', 'local').lower()
    
    if backend_type == 'local':
        upload_folder = app.config.get('UPLOAD_FOLDER', 'uploads')
        _storage_instance = LocalStorage(upload_folder)
        logger.info(f"Storage backend initialized: LocalStorage at {upload_folder}")
    else:
        # 设置环境变量后调用通用工厂函数
        os.environ['STORAGE_BACKEND'] = backend_type
        _storage_instance = get_storage()
    
    return _storage_instance


def reset_storage() -> None:
    """
    重置存储实例（主要用于测试）
    """
    global _storage_instance
    _storage_instance = None


# 导出
__all__ = [
    'StorageBackend',
    'LocalStorage', 
    'get_storage',
    'init_storage',
    'reset_storage',
]
