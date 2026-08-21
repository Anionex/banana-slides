"""Idempotent submission receipts without persisted execution credentials."""
from copy import deepcopy
from datetime import datetime, timedelta
import hashlib
import json

from models import db, PlatformSubmissionReceipt, Task


class SubmissionConflict(ValueError):
    pass


def _request_hash(operation: str, data: dict) -> str:
    sanitized = deepcopy(data)
    sanitized.pop('platform_execution', None)
    canonical = json.dumps(
        {'operation': operation, 'input': sanitized},
        ensure_ascii=True,
        sort_keys=True,
        separators=(',', ':'),
        default=str,
    )
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()


def begin_submission(data: dict, operation: str, external_project_id: str):
    execution = data.get('platform_execution')
    if not isinstance(execution, dict):
        return None, False
    key = str(execution.get('idempotency_key') or '').strip()
    if not key:
        raise SubmissionConflict('platform idempotency key is required')
    digest = _request_hash(operation, data)
    existing = PlatformSubmissionReceipt.query.filter_by(idempotency_key=key).first()
    if existing:
        if existing.request_hash != digest or existing.external_project_id != external_project_id:
            raise SubmissionConflict('idempotency key was reused with different input')
        if existing.status == 'INTERRUPTED_RETRYABLE':
            existing.attempt_no += 1
            existing.status = 'PENDING'
            existing.error_code = None
            existing.current_task_id = None
            existing.updated_at = datetime.utcnow()
            db.session.flush()
            return existing, False
        return existing, True
    receipt = PlatformSubmissionReceipt(
        platform_project_id=int(execution['project_id']),
        platform_job_id=int(execution['job_id']),
        external_project_id=external_project_id,
        operation=operation,
        idempotency_key=key,
        request_hash=digest,
        status='PENDING',
    )
    db.session.add(receipt)
    db.session.flush()
    return receipt, False


def begin_project_creation(data: dict):
    key = str(data.get('idempotency_key') or '').strip()
    platform_project_id = data.get('platform_project_id')
    if not key or platform_project_id is None:
        return None, False
    digest = _request_hash('CREATE_PROJECT', data)
    existing = PlatformSubmissionReceipt.query.filter_by(idempotency_key=key).first()
    if existing:
        if existing.request_hash != digest or existing.platform_project_id != int(platform_project_id):
            raise SubmissionConflict('idempotency key was reused with different project input')
        return existing, existing.external_project_id is not None
    receipt = PlatformSubmissionReceipt(
        platform_project_id=int(platform_project_id),
        platform_job_id=None,
        external_project_id=None,
        operation='CREATE_PROJECT',
        idempotency_key=key,
        request_hash=digest,
        status='PENDING',
    )
    db.session.add(receipt)
    db.session.flush()
    return receipt, False


def attach_project(receipt, project_id: str):
    if receipt is None:
        return
    receipt.external_project_id = project_id
    receipt.status = 'COMPLETED'
    receipt.updated_at = datetime.utcnow()


def attach_task(receipt, task_id: str):
    if receipt is None:
        return
    receipt.current_task_id = task_id
    receipt.status = 'SUBMITTED'
    receipt.updated_at = datetime.utcnow()


def mark_completed(receipt):
    if receipt is None:
        return
    receipt.status = 'COMPLETED'
    receipt.error_code = None
    receipt.updated_at = datetime.utcnow()


def mark_failed(receipt, code='ENGINE_TASK_FAILED'):
    if receipt is None:
        return
    receipt.status = 'FAILED'
    receipt.error_code = code
    receipt.updated_at = datetime.utcnow()


def sync_receipt_terminal_state(task):
    """Persist a linked async task terminal state in the same transaction."""
    if task is None or task.status not in {
        'COMPLETED', 'SUCCESS', 'FAILED', 'INTERRUPTED_RETRYABLE'
    }:
        return None
    receipt = PlatformSubmissionReceipt.query.filter_by(
        current_task_id=task.id
    ).first()
    if receipt is None:
        return None
    if task.status in {'COMPLETED', 'SUCCESS'}:
        mark_completed(receipt)
    elif task.status == 'INTERRUPTED_RETRYABLE':
        receipt.status = 'INTERRUPTED_RETRYABLE'
        receipt.error_code = 'ENGINE_INTERRUPTED'
        receipt.updated_at = datetime.utcnow()
    else:
        mark_failed(receipt)
    return receipt


def receipt_view(receipt):
    status = receipt.status
    progress = {'total': 0, 'completed': 0, 'failed': 0}
    error_code = receipt.error_code
    if receipt.current_task_id:
        task = db.session.get(Task, receipt.current_task_id)
        if task:
            status = task.status
            progress = task.get_progress()
            if status == 'INTERRUPTED_RETRYABLE':
                error_code = 'ENGINE_INTERRUPTED'
    public_status = {
        'PENDING': 'PENDING',
        'SUBMITTED': 'PENDING',
        'PROCESSING': 'PROCESSING',
        'COMPLETED': 'COMPLETED',
        'SUCCESS': 'COMPLETED',
        'INTERRUPTED_RETRYABLE': 'FAILED',
    }.get(status, 'FAILED')
    total = int(progress.get('total') or 0)
    completed = int(progress.get('completed') or 0)
    percentage = 100 if public_status == 'COMPLETED' else (completed * 100 // total if total else 0)
    result = {
        'task_id': receipt.current_task_id,
        'status': public_status,
        'progress': {'percentage': percentage, **progress},
        'retryable': status == 'INTERRUPTED_RETRYABLE',
        'error_code': error_code,
        'attempt_no': receipt.attempt_no,
    }
    if receipt.operation == 'EXPORT_PPTX' and public_status == 'COMPLETED':
        result['download_url'] = (
            f'/files/{receipt.external_project_id}/exports/'
            f'presentation_{receipt.external_project_id}.pptx'
        )
    return result


def interrupt_orphaned_tasks():
    task_ids = [row[0] for row in db.session.query(Task.id).filter(Task.status.in_(['PENDING', 'PROCESSING'])).all()]
    if not task_ids:
        return 0
    Task.query.filter(Task.id.in_(task_ids)).update(
        {Task.status: 'INTERRUPTED_RETRYABLE', Task.error_message: 'Engine process restarted'},
        synchronize_session=False,
    )
    PlatformSubmissionReceipt.query.filter(
        PlatformSubmissionReceipt.current_task_id.in_(task_ids)
    ).update(
        {PlatformSubmissionReceipt.status: 'INTERRUPTED_RETRYABLE',
         PlatformSubmissionReceipt.error_code: 'ENGINE_INTERRUPTED'},
        synchronize_session=False,
    )
    db.session.commit()
    return len(task_ids)


def reconcile_terminal_receipts():
    """Repair stale receipts left by older async workers after a restart."""
    receipts = PlatformSubmissionReceipt.query.filter(
        PlatformSubmissionReceipt.status.in_([
            'PENDING', 'SUBMITTED', 'PROCESSING', 'INTERRUPTED_RETRYABLE'
        ]),
    ).all()
    reconciled = 0
    for receipt in receipts:
        if receipt.current_task_id is None:
            task_type = {
                'GENERATE_DESCRIPTIONS': 'GENERATE_DESCRIPTIONS',
                'GENERATE_IMAGES': 'GENERATE_IMAGES',
            }.get(receipt.operation)
            if task_type and receipt.external_project_id:
                candidates = Task.query.filter(
                    Task.project_id == receipt.external_project_id,
                    Task.task_type == task_type,
                    Task.created_at >= receipt.created_at - timedelta(minutes=2),
                    Task.created_at <= receipt.created_at + timedelta(minutes=2),
                ).all()
                if len(candidates) == 1:
                    attach_task(receipt, candidates[0].id)
        task = db.session.get(Task, receipt.current_task_id)
        if task and sync_receipt_terminal_state(task) is not None:
            reconciled += 1
    if reconciled:
        db.session.commit()
    return reconciled
