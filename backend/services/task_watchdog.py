"""Task watchdog — liveness and stall detection for in-process background tasks.

Why this exists
---------------
Background tasks are plain ``ThreadPoolExecutor`` jobs (see ``task_manager``);
nothing about them survives a process restart. A task killed mid-run (app quit,
update install, crash, OOM) keeps its last persisted progress in the database,
so the UI keeps showing e.g. "88% 构建第 17/24 页" as if the export were still
running — forever, and across restarts.

This module gives the status endpoint a way to tell "still running" from
"orphaned / stuck":

* :class:`TaskWatchdog` keeps an in-memory heartbeat per task, refreshed by
  progress reports (cheap, no DB writes).
* :func:`evaluate_task_liveness` is called by ``GET /api/projects/<id>/tasks/<id>``
  and flips a task that provably has no worker left to ``FAILED`` with a
  machine-readable ``error_code``.
* :func:`reconcile_orphaned_tasks` does the same sweep once at application
  startup, so a restart clears the fake "still running" rows.

Assumption: one backend process per data root (the desktop app and the Docker
image both run a single process; the task pool is in-memory). The orphan check
still applies a grace window, so a task whose heartbeat is fresh is never
touched — that also covers the tiny window between creating the DB row and
registering the worker.

Environment variables
---------------------
``TASK_STALL_TIMEOUT_SECONDS``
    How long a task owned by this process may go without a heartbeat before it
    is reported as stuck (default 1200 = 20 minutes). ``0`` disables the check.
``TASK_ORPHAN_GRACE_SECONDS``
    How old the last heartbeat of a task *not* owned by this process must be
    before it is reported as interrupted (default 90 seconds).
"""
import logging
import os
import threading
import time
from datetime import datetime
from typing import Dict, Optional, Set, Tuple

logger = logging.getLogger(__name__)

ACTIVE_TASK_STATUSES = frozenset({'PENDING', 'PROCESSING', 'RUNNING'})

INTERRUPTED_ERROR_CODE = 'TASK_INTERRUPTED'
STALLED_ERROR_CODE = 'TASK_STALLED'

INTERRUPTED_MESSAGE = '任务被中断：后台服务已重启或进程已退出，该任务不会继续执行。'
INTERRUPTED_HELP_TEXT = '点任务右侧的 × 移除这条记录，然后重新发起即可。'

DEFAULT_STALL_TIMEOUT_SECONDS = 1200.0
DEFAULT_ORPHAN_GRACE_SECONDS = 90.0


def _positive_env_float(name: str, default: float) -> float:
    raw = (os.getenv(name) or '').strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except (TypeError, ValueError):
        logger.warning("%s=%r is not a number, using %s", name, raw, default)
        return default
    return value if value >= 0 else default


def get_stall_timeout_seconds() -> float:
    """Seconds without a heartbeat before an owned task counts as stuck (0 = off)."""
    return _positive_env_float('TASK_STALL_TIMEOUT_SECONDS', DEFAULT_STALL_TIMEOUT_SECONDS)


def get_orphan_grace_seconds() -> float:
    """Seconds after the last heartbeat before an unowned task counts as orphaned."""
    return _positive_env_float('TASK_ORPHAN_GRACE_SECONDS', DEFAULT_ORPHAN_GRACE_SECONDS)


class TaskWatchdog:
    """In-memory heartbeat registry for running tasks."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._heartbeats: Dict[str, Tuple[float, Optional[str]]] = {}

    def start(self, task_id: str, step: Optional[str] = None) -> None:
        self.touch(task_id, step)

    def touch(self, task_id: Optional[str], step: Optional[str] = None) -> None:
        """Record activity for ``task_id`` (keeps the previous step when omitted)."""
        if not task_id:
            return
        with self._lock:
            previous_step = self._heartbeats.get(task_id, (0.0, None))[1]
            self._heartbeats[task_id] = (time.monotonic(), step or previous_step)

    def forget(self, task_id: Optional[str]) -> None:
        if not task_id:
            return
        with self._lock:
            self._heartbeats.pop(task_id, None)

    def seconds_since_touch(self, task_id: str) -> Optional[float]:
        """Seconds since the last heartbeat, or ``None`` when never tracked."""
        with self._lock:
            entry = self._heartbeats.get(task_id)
        if not entry:
            return None
        return max(0.0, time.monotonic() - entry[0])

    def last_step(self, task_id: str) -> Optional[str]:
        with self._lock:
            entry = self._heartbeats.get(task_id)
        return entry[1] if entry else None

    def tracked_ids(self) -> Set[str]:
        with self._lock:
            return set(self._heartbeats)


task_watchdog = TaskWatchdog()


def touch_task(task_id: Optional[str], step: Optional[str] = None) -> None:
    """Module-level convenience wrapper used by task functions."""
    task_watchdog.touch(task_id, step)


def _parse_progress_timestamp(raw) -> Optional[datetime]:
    if not raw:
        return None
    if isinstance(raw, datetime):
        return raw
    if isinstance(raw, (int, float)):
        try:
            return datetime.utcfromtimestamp(float(raw))
        except (OverflowError, OSError, ValueError):
            return None
    if isinstance(raw, str):
        text = raw.strip()
        if text.endswith('Z'):
            text = text[:-1]
        try:
            return datetime.fromisoformat(text)
        except ValueError:
            return None
    return None


def progress_age_seconds(task) -> Optional[float]:
    """Age of the task's last persisted activity, in seconds.

    Uses ``progress.heartbeat_at`` when present and falls back to the row's
    creation time, which is the best available signal for task types that do not
    report fine-grained progress.
    """
    progress = {}
    try:
        progress = task.get_progress() or {}
    except Exception:  # pragma: no cover - defensive against malformed rows
        progress = {}

    stamp = _parse_progress_timestamp(progress.get('heartbeat_at'))
    if stamp is None:
        stamp = _parse_progress_timestamp(task.created_at)
    if stamp is None:
        return None

    reference = datetime.utcnow()
    if stamp.tzinfo is not None:
        reference = datetime.now(stamp.tzinfo)
    return max(0.0, (reference - stamp).total_seconds())


def _format_duration(seconds: float) -> str:
    if seconds >= 3600:
        return f"{seconds / 3600:.1f} 小时"
    if seconds >= 60:
        return f"{seconds / 60:.0f} 分钟"
    return f"{seconds:.0f} 秒"


def mark_task_failed(
    task,
    *,
    error_code: str,
    message: str,
    help_text: Optional[str] = None,
    current_step: Optional[str] = None,
    error_stage: str = 'task_watchdog',
) -> bool:
    """Flip ``task`` to FAILED while keeping its last real progress visible."""
    from models import db

    if task is None or task.status not in ACTIVE_TASK_STATUSES:
        return False

    previous_progress = task.get_progress() or {}
    previous_messages = list(previous_progress.get('messages') or [])
    step_label = current_step or previous_progress.get('current_step') or '未知阶段'

    task.status = 'FAILED'
    task.error_message = message
    task.completed_at = datetime.utcnow()
    task.set_progress({
        **previous_progress,
        'total': previous_progress.get('total', 100),
        'completed': previous_progress.get('completed', previous_progress.get('percent', 0)),
        'failed': 1,
        'current_step': step_label,
        'percent': previous_progress.get('percent', 0),
        'messages': [*previous_messages, message][-10:],
        'backend_status': 'FAILED',
        'error_code': error_code,
        'error_stage': error_stage,
        'help_text': help_text,
    })
    db.session.commit()
    logger.warning("Task %s marked FAILED (%s): %s", task.id, error_code, message)
    return True


def mark_task_interrupted(task) -> bool:
    """Mark a task whose worker no longer exists (restart / process exit)."""
    age = progress_age_seconds(task)
    detail = f"最后一次进度更新在 {_format_duration(age)}前。" if age is not None else ''
    return mark_task_failed(
        task,
        error_code=INTERRUPTED_ERROR_CODE,
        message=f"{INTERRUPTED_MESSAGE}{detail}",
        help_text=INTERRUPTED_HELP_TEXT,
    )


def mark_task_stalled(task, stalled_seconds: float) -> bool:
    """Mark a task owned by this process that stopped reporting progress."""
    step = task_watchdog.last_step(task.id)
    step_detail = f"，最后一步：{step}" if step else ''
    return mark_task_failed(
        task,
        error_code=STALLED_ERROR_CODE,
        message=(
            f"任务疑似卡住：已{_format_duration(stalled_seconds)}没有进度更新"
            f"{step_detail}。"
        ),
        help_text='可以点右侧的 × 移除该任务后重新导出；若反复出现，请把应用日志发给开发者。',
    )


def _is_owned_by_this_process(task_id: str) -> bool:
    from services.task_manager import task_manager

    return task_manager.is_task_active(task_id)


def evaluate_task_liveness(task) -> bool:
    """Reconcile one task's status with the actual worker state.

    Returns ``True`` when the task was flipped to FAILED.
    """
    if task is None or task.status not in ACTIVE_TASK_STATUSES:
        return False

    if _is_owned_by_this_process(task.id):
        stall_timeout = get_stall_timeout_seconds()
        if stall_timeout <= 0:
            return False
        idle_seconds = task_watchdog.seconds_since_touch(task.id)
        if idle_seconds is None or idle_seconds <= stall_timeout:
            return False
        return mark_task_stalled(task, idle_seconds)

    grace = get_orphan_grace_seconds()
    age = progress_age_seconds(task)
    if age is None or age <= grace:
        return False
    return mark_task_interrupted(task)


def reconcile_orphaned_tasks() -> int:
    """Fail active tasks left over from a previous process.

    Called once at application startup. Tasks whose heartbeat is still fresh are
    left alone (they may belong to another process sharing the data root).
    """
    from models import Task

    grace = get_orphan_grace_seconds()
    reconciled = 0
    try:
        candidates = Task.query.filter(Task.status.in_(tuple(ACTIVE_TASK_STATUSES))).all()
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Skipped orphaned task reconciliation: %s", exc)
        return 0

    for task in candidates:
        if _is_owned_by_this_process(task.id):
            continue
        age = progress_age_seconds(task)
        if age is None or age <= grace:
            continue
        if mark_task_interrupted(task):
            reconciled += 1

    if reconciled:
        logger.info(
            "Marked %d task(s) left over from a previous run as FAILED (%s)",
            reconciled,
            INTERRUPTED_ERROR_CODE,
        )
    return reconciled
