"""
Thread Pool Task Queue

基于 ThreadPoolExecutor 的任务队列实现，用于开发和小规模部署。
"""
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, Future
from typing import Callable, Optional, Dict
from datetime import datetime

from .base import TaskQueue, TaskStatus, TaskInfo

logger = logging.getLogger(__name__)


class ThreadPoolQueue(TaskQueue):
    """
    基于线程池的任务队列
    
    使用 Python 的 ThreadPoolExecutor 实现，适用于：
    - 本地开发
    - 单机部署
    - 小规模并发任务
    
    注意：不适用于需要水平扩展或任务持久化的场景
    """
    
    def __init__(self, max_workers: int = 4):
        """
        初始化线程池队列
        
        Args:
            max_workers: 最大工作线程数
        """
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.active_tasks: Dict[str, Future] = {}
        self.task_info: Dict[str, TaskInfo] = {}
        self.lock = threading.Lock()
        
        logger.info(f"ThreadPoolQueue initialized with {max_workers} workers")
    
    def submit(self, task_id: str, func: Callable, *args, **kwargs) -> str:
        """提交任务到线程池"""
        # 创建任务信息
        info = TaskInfo(
            task_id=task_id,
            status=TaskStatus.PENDING,
            created_at=datetime.utcnow()
        )
        
        # 提交任务
        future = self.executor.submit(func, task_id, *args, **kwargs)
        
        with self.lock:
            self.active_tasks[task_id] = future
            self.task_info[task_id] = info
        
        # 添加完成回调
        future.add_done_callback(lambda f: self._on_task_done(task_id, f))
        
        logger.debug(f"Task submitted: {task_id}")
        return task_id
    
    def _on_task_done(self, task_id: str, future: Future) -> None:
        """任务完成回调"""
        try:
            exception = future.exception()
            
            with self.lock:
                if task_id in self.task_info:
                    info = self.task_info[task_id]
                    info.completed_at = datetime.utcnow()
                    
                    if exception:
                        info.status = TaskStatus.FAILED
                        info.error = str(exception)
                        logger.error(f"Task {task_id} failed: {exception}", exc_info=exception)
                    else:
                        info.status = TaskStatus.COMPLETED
                        try:
                            info.result = future.result()
                        except Exception:
                            pass
                        logger.debug(f"Task {task_id} completed")
                
                # 从活跃任务中移除
                if task_id in self.active_tasks:
                    del self.active_tasks[task_id]
                    
        except Exception as e:
            logger.error(f"Error in task callback for {task_id}: {e}", exc_info=True)
    
    def get_status(self, task_id: str) -> Optional[TaskStatus]:
        """获取任务状态"""
        with self.lock:
            if task_id in self.task_info:
                return self.task_info[task_id].status
            
            # 检查是否在活跃任务中
            if task_id in self.active_tasks:
                future = self.active_tasks[task_id]
                if future.running():
                    return TaskStatus.PROCESSING
                elif not future.done():
                    return TaskStatus.PENDING
        
        return None
    
    def is_active(self, task_id: str) -> bool:
        """检查任务是否活跃"""
        with self.lock:
            return task_id in self.active_tasks
    
    def cancel(self, task_id: str) -> bool:
        """取消任务"""
        with self.lock:
            if task_id in self.active_tasks:
                future = self.active_tasks[task_id]
                cancelled = future.cancel()
                
                if cancelled:
                    if task_id in self.task_info:
                        self.task_info[task_id].status = TaskStatus.CANCELLED
                    del self.active_tasks[task_id]
                    logger.info(f"Task {task_id} cancelled")
                
                return cancelled
        
        return False
    
    def shutdown(self, wait: bool = True) -> None:
        """关闭线程池"""
        logger.info(f"Shutting down ThreadPoolQueue (wait={wait})")
        self.executor.shutdown(wait=wait)
    
    def get_info(self, task_id: str) -> Optional[TaskInfo]:
        """获取任务详细信息"""
        with self.lock:
            return self.task_info.get(task_id)
    
    def get_active_count(self) -> int:
        """获取活跃任务数量"""
        with self.lock:
            return len(self.active_tasks)
    
    def get_pending_count(self) -> int:
        """获取等待中的任务数量"""
        count = 0
        with self.lock:
            for future in self.active_tasks.values():
                if not future.running() and not future.done():
                    count += 1
        return count
    
    # ==================== 兼容旧 API ====================
    # 为了平滑迁移，保留旧的方法名
    
    def submit_task(self, task_id: str, func: Callable, *args, **kwargs) -> str:
        """兼容旧 API: submit_task -> submit"""
        return self.submit(task_id, func, *args, **kwargs)
    
    def is_task_active(self, task_id: str) -> bool:
        """兼容旧 API: is_task_active -> is_active"""
        return self.is_active(task_id)
