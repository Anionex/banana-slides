import pytest

from models import db
from services.platform_submission_service import (
    SubmissionConflict,
    attach_task,
    begin_submission,
    reconcile_terminal_receipts,
    receipt_view,
    sync_receipt_terminal_state,
)
from types import SimpleNamespace


def payload(prompt="same"):
    return {
        "prompt": prompt,
        "platform_execution": {
            "provider": "KCD_PLATFORM",
            "project_id": 7,
            "job_id": 9,
            "idempotency_key": "ppt:7:9:images",
            "gateway_base_url": "http://backend:8080",
            "execution_token": "must-never-be-persisted",
        },
    }


def test_receipt_is_idempotent_and_does_not_persist_token(db_session):
    receipt, replayed = begin_submission(payload(), "GENERATE_IMAGES", "engine-project")
    db.session.commit()

    same, same_replayed = begin_submission(payload(), "GENERATE_IMAGES", "engine-project")

    assert replayed is False
    assert same_replayed is True
    assert same.id == receipt.id
    persisted = str({key: value for key, value in same.__dict__.items() if not key.startswith('_')})
    assert "must-never-be-persisted" not in persisted


def test_receipt_rejects_same_key_with_different_input(db_session):
    begin_submission(payload(), "GENERATE_IMAGES", "engine-project")
    db.session.commit()

    with pytest.raises(SubmissionConflict):
        begin_submission(payload("different"), "GENERATE_IMAGES", "engine-project")


def test_interrupted_receipt_opens_new_attempt(db_session):
    receipt, _ = begin_submission(payload(), "GENERATE_IMAGES", "engine-project")
    receipt.status = "INTERRUPTED_RETRYABLE"
    db.session.commit()

    resumed, replayed = begin_submission(payload(), "GENERATE_IMAGES", "engine-project")

    assert replayed is False
    assert resumed.attempt_no == 2
    assert receipt_view(resumed)["status"] == "PENDING"


@pytest.mark.parametrize(
    ("task_status", "expected_status", "expected_error"),
    [
        ("COMPLETED", "COMPLETED", None),
        ("FAILED", "FAILED", "ENGINE_TASK_FAILED"),
        ("INTERRUPTED_RETRYABLE", "INTERRUPTED_RETRYABLE", "ENGINE_INTERRUPTED"),
    ],
)
def test_async_task_terminal_state_updates_linked_receipt(
    db_session, task_status, expected_status, expected_error
):
    receipt, _ = begin_submission(payload(), "GENERATE_IMAGES", "engine-project")
    attach_task(receipt, "task-123")
    db.session.commit()

    synced = sync_receipt_terminal_state(
        SimpleNamespace(id="task-123", status=task_status)
    )
    db.session.commit()

    assert synced.id == receipt.id
    assert receipt.status == expected_status
    assert receipt.error_code == expected_error


def test_non_terminal_task_does_not_change_receipt(db_session):
    receipt, _ = begin_submission(payload(), "GENERATE_IMAGES", "engine-project")
    attach_task(receipt, "task-123")
    db.session.commit()

    assert sync_receipt_terminal_state(
        SimpleNamespace(id="task-123", status="PROCESSING")
    ) is None
    assert receipt.status == "SUBMITTED"


def test_restart_reconciliation_repairs_stale_terminal_receipt(db_session):
    from models import Project, Task

    project = Project(idea_prompt="test", creation_type="idea")
    db.session.add(project)
    db.session.flush()
    task = Task(project_id=project.id, task_type="GENERATE_IMAGES", status="COMPLETED")
    db.session.add(task)
    db.session.flush()
    receipt, _ = begin_submission(payload(), "GENERATE_IMAGES", project.id)
    attach_task(receipt, task.id)
    db.session.commit()

    assert reconcile_terminal_receipts() == 1
    assert receipt.status == "COMPLETED"


def test_restart_reconciliation_links_one_legacy_task_with_missing_id(db_session):
    from models import Project, Task

    project = Project(idea_prompt="test", creation_type="idea")
    db.session.add(project)
    db.session.flush()
    receipt, _ = begin_submission(payload(), "GENERATE_IMAGES", project.id)
    receipt.created_at = receipt.updated_at
    task = Task(project_id=project.id, task_type="GENERATE_IMAGES", status="COMPLETED")
    db.session.add(task)
    db.session.commit()

    assert receipt.current_task_id is None
    assert reconcile_terminal_receipts() == 1
    assert receipt.current_task_id == task.id
    assert receipt.status == "COMPLETED"
