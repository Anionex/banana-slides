"""Alibaba Cloud OSS storage backend."""
from __future__ import annotations

import fnmatch
import io
import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import BinaryIO, Optional, Union
from urllib.parse import quote

from PIL import Image

from .base import StorageBackend

logger = logging.getLogger(__name__)

try:
    import oss2
except ImportError:  # pragma: no cover - exercised in runtime only
    oss2 = None


class AliyunOSSStorage(StorageBackend):
    """Alibaba Cloud OSS implementation via the official oss2 SDK."""

    def __init__(
        self,
        bucket: str,
        endpoint: str,
        access_key_id: str,
        access_key_secret: str,
        public_base_url: str = '',
        signed_url_ttl: int = 3600,
        cache_dir: Optional[str] = None,
    ):
        if not bucket:
            raise ValueError('OSS bucket is required')
        if not endpoint:
            raise ValueError('OSS endpoint is required')
        if not access_key_id or not access_key_secret:
            raise ValueError('OSS credentials are required')
        if oss2 is None:
            raise ImportError('oss2 is required to use the OSS storage backend')

        self.bucket_name = bucket
        self.endpoint = endpoint if endpoint.startswith('http') else f'https://{endpoint}'
        self.public_base_url = (public_base_url or '').rstrip('/')
        self.signed_url_ttl = int(signed_url_ttl or 3600)
        self.cache_dir = Path(cache_dir or os.path.join(tempfile.gettempdir(), 'banana-slides-oss-cache'))
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        auth = oss2.Auth(access_key_id, access_key_secret)
        self.bucket = oss2.Bucket(auth, self.endpoint, self.bucket_name)
        logger.info(
            'AliyunOSSStorage initialized for bucket=%s endpoint=%s public_base_url=%s',
            self.bucket_name,
            self.endpoint,
            self.public_base_url or '<presigned>',
        )

    def _normalize_path(self, relative_path: str) -> str:
        import posixpath
        normalized = relative_path.replace('\\', '/').lstrip('/')
        normalized = posixpath.normpath(normalized)
        if normalized.startswith('..'):
            raise ValueError(f'Path traversal detected: {relative_path}')
        return normalized

    def _cache_path(self, relative_path: str) -> Path:
        return self.cache_dir / self._normalize_path(relative_path)

    def save_file(self, file: Union[BinaryIO, bytes], relative_path: str) -> str:
        relative_path = self._normalize_path(relative_path)
        headers = self._headers(relative_path)
        if isinstance(file, bytes):
            payload = file
        elif hasattr(file, 'stream'):
            stream = file.stream
            if hasattr(stream, 'seek'):
                stream.seek(0)
            payload = stream
        else:
            if hasattr(file, 'seek'):
                file.seek(0)
            payload = file

        self.bucket.put_object(relative_path, payload, headers=headers)
        self._invalidate_cache(relative_path)
        return relative_path

    def save_image(self, image: Image.Image, relative_path: str, format: str = 'PNG', **kwargs) -> str:
        relative_path = self._normalize_path(relative_path)
        buffer = io.BytesIO()
        image.save(buffer, format=format, **kwargs)
        buffer.seek(0)
        headers = self._headers(relative_path)
        mime_type = Image.MIME.get(format.upper())
        if mime_type:
            headers['Content-Type'] = mime_type
        self.bucket.put_object(relative_path, buffer, headers=headers)
        self._invalidate_cache(relative_path)
        return relative_path

    def get_file(self, relative_path: str) -> Optional[bytes]:
        relative_path = self._normalize_path(relative_path)
        try:
            obj = self.bucket.get_object(relative_path)
            return obj.read()
        except Exception as exc:
            if self._is_not_found(exc):
                return None
            raise

    def delete_file(self, relative_path: str) -> bool:
        relative_path = self._normalize_path(relative_path)
        self.bucket.delete_object(relative_path)
        self._invalidate_cache(relative_path)
        return True

    def delete_directory(self, relative_path: str) -> bool:
        files = self.list_files(relative_path)
        for key in files:
            self.delete_file(key)
        return True

    def file_exists(self, relative_path: str) -> bool:
        relative_path = self._normalize_path(relative_path)
        try:
            return bool(self.bucket.object_exists(relative_path))
        except Exception as exc:
            if self._is_not_found(exc):
                return False
            raise

    def list_files(self, relative_path: str, pattern: str = '*') -> list[str]:
        prefix = self._normalize_path(relative_path).rstrip('/')
        if prefix:
            prefix += '/'

        iterator_cls = getattr(oss2, 'ObjectIteratorV2', None) or getattr(oss2, 'ObjectIterator', None)
        if iterator_cls is None:
            return []

        files: list[str] = []
        for obj in iterator_cls(self.bucket, prefix=prefix):
            key = getattr(obj, 'key', '')
            if not key or key.endswith('/'):
                continue
            if fnmatch.fnmatch(Path(key).name, pattern):
                files.append(key)
        return files

    def get_absolute_path(self, relative_path: str) -> str:
        relative_path = self._normalize_path(relative_path)
        cached = self._cache_path(relative_path)
        cached.parent.mkdir(parents=True, exist_ok=True)
        if not cached.exists() and self.file_exists(relative_path):
            self.bucket.get_object_to_file(relative_path, str(cached))
        return str(cached)

    def get_public_url(self, relative_path: str) -> str:
        relative_path = self._normalize_path(relative_path)
        if self.public_base_url:
            return f'{self.public_base_url}/{quote(relative_path)}'
        return self.bucket.sign_url('GET', relative_path, self.signed_url_ttl, slash_safe=True)

    def ensure_directory(self, relative_path: str) -> None:
        return None

    def _headers(self, relative_path: str) -> dict:
        ext = Path(relative_path).suffix.lower()
        content_type_map = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.pdf': 'application/pdf',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.zip': 'application/zip',
        }
        content_type = content_type_map.get(ext)
        return {'Content-Type': content_type} if content_type else {}

    def _invalidate_cache(self, relative_path: str) -> None:
        cached = self._cache_path(relative_path)
        if cached.exists():
            try:
                cached.unlink()
            except OSError:
                pass

    @staticmethod
    def _is_not_found(exc: Exception) -> bool:
        status = getattr(exc, 'status', None)
        if status == 404:
            return True
        message = str(exc).lower()
        return 'no such key' in message or 'not found' in message or '404' in message

    def clear_cache(self) -> None:
        if self.cache_dir.exists():
            shutil.rmtree(self.cache_dir, ignore_errors=True)
            self.cache_dir.mkdir(parents=True, exist_ok=True)
