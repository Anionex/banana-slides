"""
Local Storage Backend

本地文件系统存储实现，用于开发和小规模部署。
"""
import os
import shutil
import logging
from pathlib import Path
from typing import Optional, BinaryIO, Union
from PIL import Image

from .base import StorageBackend

logger = logging.getLogger(__name__)


class LocalStorage(StorageBackend):
    """
    本地文件系统存储后端
    
    将文件存储在服务器本地磁盘上，适用于：
    - 本地开发
    - 单机部署
    - 小规模用户量
    """
    
    def __init__(self, base_path: str):
        """
        初始化本地存储
        
        Args:
            base_path: 基础存储路径（通常是 UPLOAD_FOLDER）
        """
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"LocalStorage initialized at: {self.base_path}")
    
    def _get_full_path(self, relative_path: str) -> Path:
        """获取完整路径"""
        # 规范化路径分隔符
        normalized = relative_path.replace('\\', '/')
        return self.base_path / normalized
    
    def save_file(self, file: Union[BinaryIO, bytes], relative_path: str) -> str:
        """保存文件到本地"""
        full_path = self._get_full_path(relative_path)
        
        # 确保目录存在
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        if isinstance(file, bytes):
            full_path.write_bytes(file)
        else:
            # 文件对象
            with open(full_path, 'wb') as f:
                # 处理 FileStorage 和普通文件对象
                if hasattr(file, 'save'):
                    file.save(str(full_path))
                else:
                    shutil.copyfileobj(file, f)
        
        logger.debug(f"File saved: {relative_path}")
        return relative_path
    
    def save_image(self, image: Image.Image, relative_path: str, 
                   format: str = 'PNG', **kwargs) -> str:
        """保存 PIL Image 到本地"""
        full_path = self._get_full_path(relative_path)
        
        # 确保目录存在
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 保存图片
        image.save(str(full_path), format=format, **kwargs)
        
        logger.debug(f"Image saved: {relative_path}")
        return relative_path
    
    def get_file(self, relative_path: str) -> Optional[bytes]:
        """从本地读取文件"""
        full_path = self._get_full_path(relative_path)
        
        if not full_path.exists() or not full_path.is_file():
            return None
        
        return full_path.read_bytes()
    
    def delete_file(self, relative_path: str) -> bool:
        """删除本地文件"""
        full_path = self._get_full_path(relative_path)
        
        if full_path.exists() and full_path.is_file():
            full_path.unlink()
            logger.debug(f"File deleted: {relative_path}")
            return True
        
        return False
    
    def delete_directory(self, relative_path: str) -> bool:
        """删除目录及其内容"""
        full_path = self._get_full_path(relative_path)
        
        if full_path.exists() and full_path.is_dir():
            shutil.rmtree(full_path)
            logger.debug(f"Directory deleted: {relative_path}")
            return True
        
        return False
    
    def file_exists(self, relative_path: str) -> bool:
        """检查文件是否存在"""
        full_path = self._get_full_path(relative_path)
        return full_path.exists() and full_path.is_file()
    
    def list_files(self, relative_path: str, pattern: str = "*") -> list[str]:
        """列出目录下的文件"""
        full_path = self._get_full_path(relative_path)
        
        if not full_path.exists() or not full_path.is_dir():
            return []
        
        files = []
        for file in full_path.glob(pattern):
            if file.is_file():
                # 返回相对于 base_path 的路径
                files.append(file.relative_to(self.base_path).as_posix())
        
        return files
    
    def get_absolute_path(self, relative_path: str) -> str:
        """获取绝对路径"""
        return str(self._get_full_path(relative_path))
    
    def get_public_url(self, relative_path: str) -> str:
        """
        获取公开访问 URL
        
        本地存储通过 Flask 静态文件服务提供访问
        """
        # 规范化路径
        normalized = relative_path.replace('\\', '/')
        return f"/files/{normalized}"
    
    def ensure_directory(self, relative_path: str) -> None:
        """确保目录存在"""
        full_path = self._get_full_path(relative_path)
        full_path.mkdir(parents=True, exist_ok=True)
    
    # ==================== 优化的本地实现 ====================
    
    def copy_file(self, src_path: str, dest_path: str) -> str:
        """本地复制文件（更高效）"""
        src_full = self._get_full_path(src_path)
        dest_full = self._get_full_path(dest_path)
        
        if not src_full.exists():
            raise FileNotFoundError(f"Source file not found: {src_path}")
        
        dest_full.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_full, dest_full)
        
        return dest_path
    
    def move_file(self, src_path: str, dest_path: str) -> str:
        """本地移动文件（更高效）"""
        src_full = self._get_full_path(src_path)
        dest_full = self._get_full_path(dest_path)
        
        if not src_full.exists():
            raise FileNotFoundError(f"Source file not found: {src_path}")
        
        dest_full.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(src_full, dest_full)
        
        return dest_path
