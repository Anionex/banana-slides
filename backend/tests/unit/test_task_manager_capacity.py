import pytest

from services.task_manager import TaskCapacityError, TaskManager


def test_task_manager_rejects_work_above_bounded_capacity():
    blocker = __import__('threading').Event()
    manager = TaskManager(max_workers=1, max_pending=1)
    try:
        manager.submit_task("first", lambda task_id: blocker.wait(2))
        with pytest.raises(TaskCapacityError):
            manager.submit_task("second", lambda task_id: None)
    finally:
        blocker.set()
        manager.shutdown()
