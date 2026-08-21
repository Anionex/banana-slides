from types import SimpleNamespace

from services.task_manager import apply_batch_terminal_state


def test_batch_with_failed_pages_is_not_reported_completed():
    task = SimpleNamespace(status="PROCESSING", error_message=None, completed_at=None)

    apply_batch_terminal_state(task, failed=3, total=3, label="Image")

    assert task.status == "FAILED"
    assert task.error_message == "Image generation failed for 3/3 pages"
    assert task.completed_at is not None


def test_successful_batch_clears_previous_error():
    task = SimpleNamespace(
        status="PROCESSING",
        error_message="previous attempt failed",
        completed_at=None,
    )

    apply_batch_terminal_state(task, failed=0, total=3, label="Description")

    assert task.status == "COMPLETED"
    assert task.error_message is None
