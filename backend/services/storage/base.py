"""
Storage Backend Abstract Base Class

定义存储后端的抽象接口，支持本地存储和云存储（S3等）的无缝切换。
"""
from abc import ABC, abstractmethod
from typing import Optional, BinaryIO, Union
from pathlib import Path
from PIL import Image


class StorageBackend(ABC):
    """
    存储后端抽象基类
    
    所有存储实现（本地、S3、OSS等）都必须继承此类并实现所有抽象方法。
    这样业务代码可以通过工厂函数获取存储实例，而不需要关心具体实现。
    """
    
    @abstractmethod
    def save_file(self, file: Union[BinaryIO, bytes], relative_path: str) -> str:
        """
        保存文件到存储
        
        Args:
            file: 文件对象或字节数据
            relative_path: 相对路径（如 "project_id/pages/image.png"）
            
        Returns:
            保存后的相对路径
        """
        pass
    
    @abstractmethod
    def save_image(self, image: Image.Image, relative_path: str, 
                   format: str = 'PNG', **kwargs) -> str:
        """
        保存 PIL Image 到存储
        
        Args:
            image: PIL Image 对象
            relative_path: 相对路径
            format: 图片格式（PNG, JPEG, WEBP 等）
            **kwargs: 额外参数（如 quality, optimize 等）
            
        Returns:
            保存后的相对路径
        """
        pass
    
    @abstractmethod
    def get_file(self, relative_path: str) -> Optional[bytes]:
        """
        从存储获取文件内容
        
        Args:
            relative_path: 相对路径
            
        Returns:
            文件字节内容，文件不存在返回 None
        """
        pass
    
    @abstractmethod
    def delete_file(self, relative_path: str) -> bool:
        """
        删除文件
        
        Args:
            relative_path: 相对路径
            
        Returns:
            是否删除成功
        """
        pass
    
    @abstractmethod
    def delete_directory(self, relative_path: str) -> bool:
        """
        删除目录及其所有内容
        
        Args:
            relative_path: 相对路径
            
        Returns:
            是否删除成功
        """
        pass
    
    @abstractmethod
    def file_exists(self, relative_path: str) -> bool:
        """
        检查文件是否存在
        
        Args:
            relative_path: 相对路径
            
        Returns:
            文件是否存在
        """
        pass
    
    @abstractmethod
    def list_files(self, relative_path: str, pattern: str = "*") -> list[str]:
        """
        列出目录下的文件
        
        Args:
            relative_path: 目录相对路径
            pattern: 文件匹配模式（如 "*.png"）
            
        Returns:
            文件相对路径列表
        """
        pass
    
    @abstractmethod
    def get_absolute_path(self, relative_path: str) -> str:
        """
        获取绝对路径（本地存储）或完整 URL（云存储）
        
        Args:
            relative_path: 相对路径
            
        Returns:
            绝对路径或 URL
        """
        pass
    
    @abstractmethod
    def get_public_url(self, relative_path: str) -> str:
        """
        获取公开访问 URL
        
        Args:
            relative_path: 相对路径
            
        Returns:
            可公开访问的 URL
        """
        pass
    
    @abstractmethod
    def ensure_directory(self, relative_path: str) -> None:
        """
        确保目录存在
        
        Args:
            relative_path: 目录相对路径
        """
        pass
    
    # ==================== 高级便捷方法 ====================
    # 这些方法有默认实现，子类可以选择性重写以优化性能
    
    def copy_file(self, src_path: str, dest_path: str) -> str:
        """
        复制文件
        
        Args:
            src_path: 源文件相对路径
            dest_path: 目标文件相对路径
            
        Returns:
            目标文件相对路径
        """
        content = self.get_file(src_path)
        if content is None:
            raise FileNotFoundError(f"Source file not found: {src_path}")
        return self.save_file(content, dest_path)
    
    def move_file(self, src_path: str, dest_path: str) -> str:
        """
        移动文件
        
        Args:
            src_path: 源文件相对路径
            dest_path: 目标文件相对路径
            
        Returns:
            目标文件相对路径
        """
        result = self.copy_file(src_path, dest_path)
        self.delete_file(src_path)
        return result
