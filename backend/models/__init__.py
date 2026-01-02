"""Database models package"""
from flask_sqlalchemy import SQLAlchemy

# 创建 SQLAlchemy 实例，配置 SQLite 连接选项
db = SQLAlchemy(
    engine_options={
        'connect_args': {
            'check_same_thread': False,  # 允许跨线程使用（仅SQLite）
            'timeout': 30,  # 数据库锁定超时（秒）- SQLite特定
        },
        'pool_pre_ping': True,  # 连接前检查，确保连接有效
        'pool_recycle': 3600,  # 1小时回收连接，释放文件句柄
        'pool_size': 5,  # SQLite连接池不需要太大（建议5-10）
        'max_overflow': 10,  # 溢出连接数（SQLite受文件锁限制，不宜过大）
        'pool_timeout': 30,  # 获取连接的超时时间（秒）
    }
)

from .project import Project
from .page import Page
from .task import Task
from .user_template import UserTemplate
from .page_image_version import PageImageVersion
from .material import Material
from .reference_file import ReferenceFile
from .settings import Settings

__all__ = ['db', 'Project', 'Page', 'Task', 'UserTemplate', 'PageImageVersion', 'Material', 'ReferenceFile', 'Settings']

