"""
Memory monitor utility for tracking memory usage
"""
import os
import psutil
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class MemoryMonitor:
    """Simple memory monitoring utility"""

    @staticmethod
    def get_memory_usage():
        """Get current memory usage in MB"""
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        return {
            'rss': memory_info.rss / 1024 / 1024,  # Physical memory
            'vms': memory_info.vms / 1024 / 1024,  # Virtual memory
            'percent': process.memory_percent()
        }

    @staticmethod
    def log_memory_usage(label=""):
        """Log current memory usage"""
        memory = MemoryMonitor.get_memory_usage()
        logger.info(f"[{label}] Memory usage - RSS: {memory['rss']:.1f}MB, "
                   f"VMS: {memory['vms']:.1f}MB, Percent: {memory['percent']:.1f}%")

    @staticmethod
    def check_memory_limit(threshold_mb=512):
        """Check if memory usage exceeds threshold"""
        memory = MemoryMonitor.get_memory_usage()
        if memory['rss'] > threshold_mb:
            logger.warning(f"Memory usage ({memory['rss']:.1f}MB) exceeds threshold ({threshold_mb}MB)")
            return True
        return False

# Add to requirements.txt:
# psutil==5.9.8