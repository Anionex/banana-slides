"""Cloudflare R2 storage backend using the S3-compatible API."""
from __future__ import annotations

import io
import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import BinaryIO, Optional, Union
from urllib.parse import quote

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError
from PIL import Image

from .base import StorageBackend

logger = logging.getLogger(__name__)


class R2Storage(StorageBackend):
    """Cloudflare R2 implementation via boto3's S3 client."""

    def __init__(
        self,
        bucket: str,
        account_id: str,
        access_key_id: str,
        secret_access_key: str,
        public_base_url: str = "",
        region: str = "auto",
        endpoint_url: str = "",
        signed_url_ttl: int = 3600,
        cache_dir: Optional[str] = None,
    ):
        if not bucket:
            raise ValueError("R2 bucket is required")
        if not account_id and not endpoint_url:
            raise ValueError("R2 account id or endpoint url is required")
        if not access_key_id or not secret_access_key:
            raise ValueError("R2 access key credentials are required")

        self.bucket = bucket
        self.account_id = account_id
        self.public_base_url = (public_base_url or "").rstrip("/")
        self.region = region or "auto"
        self.endpoint_url = endpoint_url or f"https://{account_id}.r2.cloudflarestorage.com"
        self.signed_url_ttl = int(signed_url_ttl or 3600)
        self.cache_dir = Path(cache_dir or os.path.join(tempfile.gettempdir(), "banana-slides-r2-cache"))
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        self.client = boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name=self.region,
            config=BotoConfig(signature_version="s3v4"),
        )

        logger.info(
            "R2Storage initialized for bucket=%s endpoint=%s public_base_url=%s",
            self.bucket,
            self.endpoint_url,
            self.public_base_url or "<presigned>",
        )

    def _normalize_path(self, relative_path: str) -> str:
        import posixpath
        normalized = relative_path.replace("\\", "/").lstrip("/")
        normalized = posixpath.normpath(normalized)
        if normalized.startswith(".."):
            raise ValueError(f"Path traversal detected: {relative_path}")
        return normalized

    def _cache_path(self, relative_path: str) -> Path:
        normalized = self._normalize_path(relative_path)
        return self.cache_dir / normalized

    def save_file(self, file: Union[BinaryIO, bytes], relative_path: str) -> str:
        relative_path = self._normalize_path(relative_path)
        extra_args = self._extra_args(relative_path)

        if isinstance(file, bytes):
            payload = io.BytesIO(file)
        elif hasattr(file, "stream"):
            payload = file.stream
        else:
            payload = file

        if hasattr(payload, "seek"):
            payload.seek(0)

        self.client.upload_fileobj(payload, self.bucket, relative_path, ExtraArgs=extra_args)
        self._invalidate_cache(relative_path)
        logger.debug("Uploaded file to R2: %s", relative_path)
        return relative_path

    def save_image(self, image: Image.Image, relative_path: str, format: str = "PNG", **kwargs) -> str:
        relative_path = self._normalize_path(relative_path)
        buffer = io.BytesIO()
        image.save(buffer, format=format, **kwargs)
        buffer.seek(0)
        extra_args = self._extra_args(relative_path)
        if "ContentType" not in extra_args:
            extra_args["ContentType"] = Image.MIME.get(format.upper(), "application/octet-stream")
        self.client.upload_fileobj(buffer, self.bucket, relative_path, ExtraArgs=extra_args)
        self._invalidate_cache(relative_path)
        logger.debug("Uploaded image to R2: %s", relative_path)
        return relative_path

    def get_file(self, relative_path: str) -> Optional[bytes]:
        relative_path = self._normalize_path(relative_path)
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=relative_path)
            return response["Body"].read()
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in {"NoSuchKey", "404", "NotFound"}:
                return None
            raise

    def delete_file(self, relative_path: str) -> bool:
        relative_path = self._normalize_path(relative_path)
        self.client.delete_object(Bucket=self.bucket, Key=relative_path)
        self._invalidate_cache(relative_path)
        return True

    def delete_directory(self, relative_path: str) -> bool:
        prefix = self._normalize_path(relative_path).rstrip("/") + "/"
        paginator = self.client.get_paginator("list_objects_v2")
        objects_to_delete = []
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                objects_to_delete.append({"Key": obj["Key"]})
                self._invalidate_cache(obj["Key"])

        if not objects_to_delete:
            return True

        for idx in range(0, len(objects_to_delete), 1000):
            chunk = objects_to_delete[idx: idx + 1000]
            self.client.delete_objects(Bucket=self.bucket, Delete={"Objects": chunk})
        return True

    def file_exists(self, relative_path: str) -> bool:
        relative_path = self._normalize_path(relative_path)
        try:
            self.client.head_object(Bucket=self.bucket, Key=relative_path)
            return True
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
                return False
            raise

    def list_files(self, relative_path: str, pattern: str = "*") -> list[str]:
        import fnmatch

        prefix = self._normalize_path(relative_path).rstrip("/")
        if prefix:
            prefix += "/"

        paginator = self.client.get_paginator("list_objects_v2")
        files: list[str] = []
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                name = Path(key).name
                if fnmatch.fnmatch(name, pattern):
                    files.append(key)
        return files

    def get_absolute_path(self, relative_path: str) -> str:
        """Return a readable local cache path for consumers that expect filesystem access."""
        relative_path = self._normalize_path(relative_path)
        cached = self._cache_path(relative_path)
        cached.parent.mkdir(parents=True, exist_ok=True)

        # Only download if object exists and cache is missing.
        if not cached.exists() and self.file_exists(relative_path):
            with open(cached, "wb") as handle:
                self.client.download_fileobj(self.bucket, relative_path, handle)
        return str(cached)

    def get_public_url(self, relative_path: str) -> str:
        relative_path = self._normalize_path(relative_path)
        if self.public_base_url:
            return f"{self.public_base_url}/{quote(relative_path)}"
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": relative_path},
            ExpiresIn=self.signed_url_ttl,
        )

    def ensure_directory(self, relative_path: str) -> None:
        # Object storage has no real directories. Nothing to do.
        return None

    def _extra_args(self, relative_path: str) -> dict:
        relative_path = self._normalize_path(relative_path)
        ext = Path(relative_path).suffix.lower()
        content_type_map = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".svg": "image/svg+xml",
            ".pdf": "application/pdf",
            ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".zip": "application/zip",
        }
        extra_args = {}
        content_type = content_type_map.get(ext)
        if content_type:
            extra_args["ContentType"] = content_type
        return extra_args

    def _invalidate_cache(self, relative_path: str) -> None:
        cached = self._cache_path(relative_path)
        if cached.exists():
            try:
                cached.unlink()
            except OSError:
                pass

    def clear_cache(self) -> None:
        if self.cache_dir.exists():
            shutil.rmtree(self.cache_dir, ignore_errors=True)
            self.cache_dir.mkdir(parents=True, exist_ok=True)
