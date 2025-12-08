"""
定期清理脚本，用于释放内存
"""
import logging
import gc
import os
from datetime import datetime, timedelta
from models import db, Task, Project
from utils.memory_monitor import MemoryMonitor

logger = logging.getLogger(__name__)

def cleanup_old_tasks():
    """清理超过24小时的已完成任务记录"""
    try:
        cutoff = datetime.utcnow() - timedelta(hours=24)
        old_tasks = Task.query.filter(
            Task.status.in_(['COMPLETED', 'FAILED']),
            Task.completed_at < cutoff
        ).all()

        count = len(old_tasks)
        for task in old_tasks:
            db.session.delete(task)

        if count > 0:
            db.session.commit()
            logger.info(f"Cleaned up {count} old tasks")

    except Exception as e:
        logger.error(f"Error cleaning up old tasks: {e}")
        db.session.rollback()

def force_garbage_collection():
    """强制垃圾回收"""
    before = MemoryMonitor.get_memory_usage()
    gc.collect()
    after = MemoryMonitor.get_memory_usage()

    freed = before['rss'] - after['rss']
    if freed > 10:  # 如果释放超过10MB
        logger.info(f"Garbage collection freed {freed:.1f}MB")

def periodic_cleanup():
    """定期清理任务"""
    logger.info("Starting periodic cleanup...")

    # 记录清理前内存
    MemoryMonitor.log_memory_usage("Before cleanup")

    # 清理旧任务
    cleanup_old_tasks()

    # 强制垃圾回收
    force_garbage_collection()

    # 记录清理后内存
    MemoryMonitor.log_memory_usage("After cleanup")

    logger.info("Periodic cleanup completed")

if __name__ == "__main__":
    periodic_cleanup()