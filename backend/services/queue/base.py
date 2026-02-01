"""
Task Queue Abstract Base Class

定义任务队列的抽象接口，支持线程池和消息队列（Celery等）的无缝切换。
"""
from abc import ABC, abstractmethod
from typing import Callable, Any, Optional
from dataclasses import dataclass
from enum import Enum
from datetime import datetime


class TaskStatus(Enum):
    """任务状态枚举"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class TaskInfo:
    """任务信息数据类"""
    task_id: str
    status: TaskStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    result: Optional[Any] = None


class TaskQueue(ABC):
    """
    任务队列抽象基类
    
    所有队列实现（线程池、Celery、RQ等）都必须继承此类并实现所有抽象方法。
    这样业务代码可以通过工厂函数获取队列实例，而不需要关心具体实现。
    """
    
    @abstractmethod
    def submit(self, task_id: str, func: Callable, *args, **kwargs) -> str:
        """
        提交任务到队列
        
        Args:
            task_id: 任务ID（用于追踪）
            func: 要执行的函数
            *args: 位置参数
            **kwargs: 关键字参数
            
        Returns:
            任务ID
        """
        pass
    
    @abstractmethod
    def get_status(self, task_id: str) -> Optional[TaskStatus]:
        """
        获取任务状态
        
        Args:
            task_id: 任务ID
            
        Returns:
            任务状态，任务不存在返回 None
        """
        pass
    
    @abstractmethod
    def is_active(self, task_id: str) -> bool:
        """
        检查任务是否正在运行
        
        Args:
            task_id: 任务ID
            
        Returns:
            任务是否活跃（PENDING 或 PROCESSING）
        """
        pass
    
    @abstractmethod
    def cancel(self, task_id: str) -> bool:
        """
        取消任务
        
        Args:
            task_id: 任务ID
            
        Returns:
            是否取消成功
        """
        pass
    
    @abstractmethod
    def shutdown(self, wait: bool = True) -> None:
        """
        关闭队列
        
        Args:
            wait: 是否等待所有任务完成
        """
        pass
    
    # ==================== 可选方法 ====================
    # 子类可以选择性实现，基类提供默认行为
    
    def get_info(self, task_id: str) -> Optional[TaskInfo]:
        """
        获取任务详细信息
        
        Args:
            task_id: 任务ID
            
        Returns:
            任务信息，任务不存在返回 None
        """
        status = self.get_status(task_id)
        if status is None:
            return None
        return TaskInfo(
            task_id=task_id,
            status=status,
            created_at=datetime.utcnow()  # 默认实现不追踪创建时间
        )
    
    def get_active_count(self) -> int:
        """
        获取活跃任务数量
        
        Returns:
            活跃任务数量
        """
        return 0  # 默认实现
    
    def get_pending_count(self) -> int:
        """
        获取等待中的任务数量
        
        Returns:
            等待中的任务数量
        """
        return 0  # 默认实现
