"""
Task Queue Service Package

提供任务队列抽象层，支持线程池和消息队列（Celery等）的无缝切换。

使用方法:
    from services.queue import get_queue
    
    queue = get_queue()
    queue.submit("task-123", my_task_function, arg1, arg2)
"""
import os
import logging
from typing import Optional

from .base import TaskQueue, TaskStatus, TaskInfo
from .thread_pool import ThreadPoolQueue

logger = logging.getLogger(__name__)

# 全局队列实例缓存
_queue_instance: Optional[TaskQueue] = None


def get_queue() -> TaskQueue:
    """
    获取任务队列实例（工厂函数）
    
    根据环境变量 TASK_QUEUE 决定使用哪种队列后端：
    - thread: 线程池（默认）
    - celery: Celery 分布式队列（未来实现）
    - rq: Redis Queue（未来实现）
    
    Returns:
        TaskQueue 实例
    
    Example:
        queue = get_queue()
        queue.submit("task-123", process_data, data)
    """
    global _queue_instance
    
    if _queue_instance is not None:
        return _queue_instance
    
    queue_type = os.environ.get('TASK_QUEUE', 'thread').lower()
    max_workers = int(os.environ.get('TASK_QUEUE_WORKERS', '4'))
    
    if queue_type == 'thread':
        _queue_instance = ThreadPoolQueue(max_workers=max_workers)
        logger.info(f"Task queue initialized: ThreadPoolQueue with {max_workers} workers")
    
    elif queue_type == 'celery':
        # TODO: 实现 Celery 队列后端
        # from .celery_queue import CeleryQueue
        # _queue_instance = CeleryQueue(
        #     broker=os.environ.get('CELERY_BROKER_URL'),
        #     backend=os.environ.get('CELERY_RESULT_BACKEND'),
        # )
        raise NotImplementedError("Celery queue backend not yet implemented")
    
    elif queue_type == 'rq':
        # TODO: 实现 Redis Queue 后端
        raise NotImplementedError("RQ queue backend not yet implemented")
    
    else:
        raise ValueError(f"Unknown task queue type: {queue_type}")
    
    return _queue_instance


def init_queue(app) -> TaskQueue:
    """
    使用 Flask app 配置初始化任务队列
    
    Args:
        app: Flask application instance
        
    Returns:
        TaskQueue 实例
    """
    global _queue_instance
    
    queue_type = app.config.get('TASK_QUEUE', 'thread').lower()
    max_workers = app.config.get('TASK_QUEUE_WORKERS', 4)
    
    if queue_type == 'thread':
        _queue_instance = ThreadPoolQueue(max_workers=max_workers)
        logger.info(f"Task queue initialized: ThreadPoolQueue with {max_workers} workers")
    else:
        # 设置环境变量后调用通用工厂函数
        os.environ['TASK_QUEUE'] = queue_type
        _queue_instance = get_queue()
    
    return _queue_instance


def reset_queue() -> None:
    """
    重置队列实例（主要用于测试）
    """
    global _queue_instance
    if _queue_instance is not None:
        _queue_instance.shutdown(wait=False)
    _queue_instance = None


# ==================== 兼容旧 API ====================
# 为了平滑迁移，提供 task_manager 兼容层

class TaskManagerCompat:
    """
    兼容旧的 task_manager API
    
    旧代码:
        from services.task_manager import task_manager
        task_manager.submit_task(task_id, func, *args)
    
    新代码会自动转发到新的队列系统
    """
    
    def submit_task(self, task_id: str, func, *args, **kwargs):
        """兼容旧 API"""
        return get_queue().submit(task_id, func, *args, **kwargs)
    
    def is_task_active(self, task_id: str) -> bool:
        """兼容旧 API"""
        return get_queue().is_active(task_id)
    
    def shutdown(self):
        """兼容旧 API"""
        get_queue().shutdown()


# 创建兼容实例（在 task_manager.py 中会被引用）
task_manager_compat = TaskManagerCompat()


# 导出
__all__ = [
    'TaskQueue',
    'TaskStatus',
    'TaskInfo',
    'ThreadPoolQueue',
    'get_queue',
    'init_queue',
    'reset_queue',
    'task_manager_compat',
]
