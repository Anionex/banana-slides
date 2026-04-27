"""
Path utilities for handling MinerU file paths and prefix matching
"""
import os
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def convert_mineru_path_to_local(mineru_path: str, project_root: Optional[Path] = None) -> Optional[Path]:
    """
    将 /files/mineru/{extract_id}/{rel_path} 格式的路径转换为本地文件系统路径
    
    Args:
        mineru_path: MinerU URL 路径，格式为 /files/mineru/{extract_id}/{rel_path}
        project_root: 项目根目录路径（如果为 None，则自动计算）
        
    Returns:
        本地文件系统路径（Path 对象），如果转换失败则返回 None
    """
    try:
        if not mineru_path.startswith('/files/mineru/'):
            return None
        
        # Remove '/files/mineru/' prefix
        rel_path = mineru_path.replace('/files/mineru/', '')
        
        # Get upload folder: prefer Flask app config (works in desktop/packaged mode),
        # fall back to path-based computation from __file__.
        if project_root is not None:
            upload_folder = project_root / 'uploads'
        else:
            try:
                from flask import current_app
                upload_folder = Path(current_app.config['UPLOAD_FOLDER'])
            except (RuntimeError, KeyError):
                # Not in Flask context — derive from file location
                current_file = Path(__file__).resolve()
                backend_dir = current_file.parent.parent
                upload_folder = backend_dir.parent / 'uploads'

        # Construct full path: {upload_folder}/mineru_files/{rel_path}
        local_path = upload_folder / 'mineru_files' / rel_path
        
        return local_path
    except Exception as e:
        logger.warning(f"Failed to convert MinerU path to local: {mineru_path}, error: {str(e)}")
        return None


def find_mineru_file_with_prefix(mineru_path: str, project_root: Optional[Path] = None) -> Optional[Path]:
    """
    查找 MinerU 文件，支持前缀匹配
    
    首先尝试直接路径匹配，如果失败则尝试前缀匹配。
    前缀匹配逻辑：如果文件名看起来像是一个前缀+扩展名（前缀长度 >= 5），
    则在目录中查找以该前缀开头的文件。
    
    Args:
        mineru_path: MinerU URL 路径，格式为 /files/mineru/{extract_id}/{rel_path}
        project_root: 项目根目录路径（如果为 None，则自动计算）
        
    Returns:
        找到的文件路径（Path 对象），如果未找到则返回 None
    """
    # First try direct path conversion
    local_path = convert_mineru_path_to_local(mineru_path, project_root)
    
    if local_path is None:
        return None
    
    # Direct file matching
    if local_path.exists() and local_path.is_file():
        return local_path
    
    # Try prefix match using the generic function
    return find_file_with_prefix(local_path)


def find_file_with_prefix(file_path: Path) -> Optional[Path]:
    """
    查找文件，支持前缀匹配
    
    首先检查文件是否存在，如果不存在则尝试前缀匹配。
    前缀匹配逻辑：如果文件名看起来像是一个前缀+扩展名（前缀长度 >= 5），
    则在目录中查找以该前缀开头的文件。
    
    Args:
        file_path: 要查找的文件路径（Path 对象）
        
    Returns:
        找到的文件路径（Path 对象），如果未找到则返回 None
    """
    # Direct file matching
    if file_path.exists() and file_path.is_file():
        return file_path
    
    # Try prefix match if not found and filename looks like a prefix with extension
    filename = file_path.name
    dirpath = file_path.parent
    
    if '.' in filename and dirpath.exists() and dirpath.is_dir():
        prefix, ext = os.path.splitext(filename)
        if len(prefix) >= 5:
            try:
                for fname in os.listdir(dirpath):
                    fp, fe = os.path.splitext(fname)
                    if fp.lower().startswith(prefix.lower()) and fe.lower() == ext.lower():
                        matched_path = dirpath / fname
                        if matched_path.is_file():
                            logger.debug(f"Prefix match found: {file_path} -> {matched_path}")
                            return matched_path
            except OSError as e:
                logger.warning(f"Failed to list directory {dirpath}: {str(e)}")
    
    return None

