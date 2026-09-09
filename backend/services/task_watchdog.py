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
    How long a task owned by this process may go without writing progress before
    it is reported as stuck (default 1800 = 30 minutes). ``0`` disables the check.
``TASK_ORPHAN_GRACE_SECONDS``
    How old the last progress write of a task *not* owned by this process must be
    before it is reported as interrupted (default 300 seconds). Values <= 0 fall
    back to the default.

The heartbeat has two layers:

* every ``Task.set_progress`` call stamps ``heartbeat_at`` into the progress JSON
  (database-visible, survives restarts);
* SQLAlchemy flush events refresh the in-memory registry, so "the task row is
  being written" counts as activity for *every* task type.
"""
import json
import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Dict, Optional, Set, Tuple

from sqlalchemy import event
from sqlalchemy import update

from models import Task, db

logger = logging.getLogger(__name__)

ACTIVE_TASK_STATUSES = frozenset({'PENDING', 'PROCESSING', 'RUNNING'})

INTERRUPTED_ERROR_CODE = 'TASK_INTERRUPTED'
STALLED_ERROR_CODE = 'TASK_STALLED'

INTERRUPTED_HELP_TEXT = '点任务右侧的 × 移除这条记录，然后重新发起即可。'

DEFAULT_STALL_TIMEOUT_SECONDS = 1800.0
DEFAULT_ORPHAN_GRACE_SECONDS = 300.0

# 非导出任务（生图、视频导出、模板分析等）直接展示 error_message，
# 所以这里按应用的输出语言生成文案；导出面板另有按 error_code 的前端本地化。
_TEXTS = {
    'zh': {
        'interrupted': '任务被中断：后台服务已重启或进程已退出，该任务不会继续执行。',
        'interrupted_detail': '最后一次进度更新在 {duration}前。',
        'interrupted_help': INTERRUPTED_HELP_TEXT,
        'stalled': '任务疑似卡住：已 {duration}没有进度更新',
        'stalled_step': '（最后一步：{step}）',
        'stalled_help': '可以点右侧的 × 移除该任务后重新导出；若反复出现，请把应用日志发给开发者。',
        'hours': '{value} 小时',
        'minutes': '{value} 分钟',
        'seconds': '{value} 秒',
    },
    'en': {
        'interrupted': 'Task interrupted: the backend restarted or the process exited, so this task will not continue.',
        'interrupted_detail': ' Last progress update was {duration} ago.',
        'interrupted_help': 'Remove the entry with the × button, then start the task again.',
        'stalled': 'Task looks stuck: no progress for {duration}',
        'stalled_step': ' (last step: {step})',
        'stalled_help': 'Remove the task with the × button and run it again. If it keeps happening, send the app log to the developer.',
        'hours': '{value} hours',
        'minutes': '{value} minutes',
        'seconds': '{value} seconds',
    },
}


def _current_language() -> str:
    """用户可见文案的语言。

    优先用界面语言（前端在 Accept-Language 里带上 i18n 语言），
    其次才是应用配置的内容输出语言，最后回退中文。
    """
    try:
        from flask import current_app, has_request_context, request

        if has_request_context():
            header = (request.headers.get('Accept-Language') or '').split(',')[0].strip()
            if header:
                return header.lower()

        configured = current_app.config.get('OUTPUT_LANGUAGE')
        if configured:
            return str(configured).lower()
    except Exception:  # pragma: no cover - 请求上下文之外
        pass
    return (os.getenv('OUTPUT_LANGUAGE') or 'zh').lower()


def _texts() -> Dict[str, str]:
    return _TEXTS['en'] if _current_language().startswith('en') else _TEXTS['zh']


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
    value = _positive_env_float('TASK_ORPHAN_GRACE_SECONDS', DEFAULT_ORPHAN_GRACE_SECONDS)
    # 0 会把"非本进程"的活跃任务全部立刻判死，不是有效配置
    return value if value > 0 else DEFAULT_ORPHAN_GRACE_SECONDS


class TaskWatchdog:
    """In-memory heartbeat registry for running tasks."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._heartbeats: Dict[str, Tuple[float, Optional[str]]] = {}
        # 线程 → 任务：让长时间等待外部资源（限流槽等）的 worker
        # 也能刷新自己的心跳
        self._thread_tasks: Dict[int, str] = {}

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

    def bind_thread(self, task_id: Optional[str]) -> None:
        """把当前线程绑定到任务，便于在阻塞等待时打心跳。"""
        if not task_id:
            return
        with self._lock:
            self._thread_tasks[threading.get_ident()] = task_id

    def unbind_thread(self) -> None:
        with self._lock:
            self._thread_tasks.pop(threading.get_ident(), None)

    def touch_current_thread(self) -> None:
        """刷新当前线程所属任务的心跳（没有绑定则什么都不做）。"""
        with self._lock:
            task_id = self._thread_tasks.get(threading.get_ident())
        if task_id:
            self.touch(task_id)


task_watchdog = TaskWatchdog()


def touch_task(task_id: Optional[str], step: Optional[str] = None) -> None:
    """Module-level convenience wrapper used by task functions."""
    task_watchdog.touch(task_id, step)


@event.listens_for(Task, 'after_update')
def _touch_on_task_write(_mapper, _connection, target):
    """Any database *update* to a task counts as activity for that task.

    This is what keeps the stall check meaningful for task types that never call
    ``touch_task`` explicitly: writing progress refreshes the heartbeat.
    ``after_insert`` is deliberately excluded — the row is created before the
    worker is submitted, so counting it would let queue wait time count towards
    the stall timeout.
    """
    task_watchdog.touch(getattr(target, 'id', None))


def _parse_progress_timestamp(raw) -> Optional[datetime]:
    if not raw:
        return None
    if isinstance(raw, datetime):
        return raw
    if isinstance(raw, (int, float)):
        try:
            return datetime.fromtimestamp(float(raw), tz=timezone.utc).replace(tzinfo=None)
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
    texts = _texts()
    if seconds >= 3600:
        return texts['hours'].format(value=f"{seconds / 3600:.1f}")
    if seconds >= 60:
        return texts['minutes'].format(value=f"{seconds / 60:.0f}")
    return texts['seconds'].format(value=f"{seconds:.0f}")


def mark_task_failed(
    task,
    *,
    error_code: str,
    message: str,
    help_text: Optional[str] = None,
    current_step: Optional[str] = None,
    error_stage: str = 'task_watchdog',
    error_details: Optional[Dict] = None,
) -> bool:
    """Flip ``task`` to FAILED while keeping its last real progress visible.

    使用带状态条件的 UPDATE：如果 worker 恰好在这次查询之后提交了
    COMPLETED（此时它已从 active_tasks 移除），条件不满足，不会把成功
    覆盖成失败。
    """
    if task is None or task.status not in ACTIVE_TASK_STATUSES:
        return False

    previous_progress = task.get_progress() or {}
    previous_messages = list(previous_progress.get('messages') or [])
    step_label = current_step or previous_progress.get('current_step') or '未知阶段'

    payload = {
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
        'error_details': {**(previous_progress.get('error_details') or {}), **(error_details or {})},
        'heartbeat_at': datetime.utcnow().isoformat(),
    }

    result = db.session.execute(
        update(Task)
        .where(Task.id == task.id, Task.status.in_(tuple(ACTIVE_TASK_STATUSES)))
        .values(
            status='FAILED',
            error_message=message,
            completed_at=datetime.utcnow(),
            progress=json.dumps(payload),
        )
        .execution_options(synchronize_session=False)
    )
    db.session.commit()

    def _expire() -> None:
        try:
            db.session.expire(task)
        except Exception:  # pragma: no cover - 非 ORM 对象/已分离实例
            pass

    if not result.rowcount:
        # 任务在本次查询之后已经进入终态（例如刚好完成），不要覆盖
        _expire()
        return False

    _expire()
    logger.warning("Task %s marked FAILED (%s): %s", task.id, error_code, message)
    return True


def mark_task_interrupted(task) -> bool:
    """Mark a task whose worker no longer exists (restart / process exit)."""
    age = progress_age_seconds(task)
    texts = _texts()
    detail = texts['interrupted_detail'].format(duration=_format_duration(age)) if age is not None else ''
    return mark_task_failed(
        task,
        error_code=INTERRUPTED_ERROR_CODE,
        message=f"{texts['interrupted']}{detail}",
        help_text=texts['interrupted_help'],
        error_details={
            'reason': 'interrupted',
            'idle_seconds': round(age, 1) if age is not None else None,
        },
    )


def mark_task_stalled(task, stalled_seconds: float) -> bool:
    """Mark a task owned by this process that stopped reporting progress."""
    texts = _texts()
    step = task_watchdog.last_step(task.id)
    step_detail = texts['stalled_step'].format(step=step) if step else ''
    return mark_task_failed(
        task,
        error_code=STALLED_ERROR_CODE,
        message=f"{texts['stalled'].format(duration=_format_duration(stalled_seconds))}{step_detail}。",
        help_text=texts['stalled_help'],
        error_details={
            'reason': 'stalled',
            'idle_seconds': round(stalled_seconds, 1),
            'last_step': step,
        },
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


def reconcile_task_for_response(task) -> bool:
    """Run :func:`evaluate_task_liveness` from a request handler, safely.

    A failure here must never break the status endpoint: the session is rolled
    back so the caller can still serialize the task.
    """
    try:
        return evaluate_task_liveness(task)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Task watchdog check failed for %s: %s", getattr(task, 'id', None), exc)
        try:
            from models import db
            db.session.rollback()
        except Exception:  # pragma: no cover - defensive
            pass
        return False


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
