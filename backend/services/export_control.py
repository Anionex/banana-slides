"""Failure propagation for one editable export and its worker dependencies.

An in-flight HTTP call cannot be killed safely. Its result is discarded after
abort; queued work, retries and subsequent stages must never start afterwards.
"""
from concurrent.futures import wait, FIRST_COMPLETED, as_completed as completed
from contextlib import contextmanager
from contextvars import ContextVar
from functools import wraps
from inspect import signature
from threading import Event, Lock
import time

from services.public_demo import VisitorThreadPoolExecutor

_current = ContextVar('editable_export_control', default=None)
_tasks = {}
_tasks_lock = Lock()


class ExportControl:
    def __init__(self, strict=True):
        self.strict = strict
        self.stopped = Event()
        self._lock = Lock()
        self.error = None

    def fail(self, error):
        with self._lock:
            if self.error is None:
                self.error = error
                self.stopped.set()

    def check(self):
        if self.stopped.is_set():
            raise self.error


def current_export():
    return _current.get()


def strict_export():
    control = current_export()
    return control is not None and control.strict


def check_export():
    control = current_export()
    if control is not None:
        control.check()


@contextmanager
def export_scope(strict=True, task_id=None):
    existing = current_export()
    if existing is not None:
        check_export()
        yield existing
        return
    control = ExportControl(strict)
    token = _current.set(control)
    if task_id:
        with _tasks_lock:
            _tasks[task_id] = control
    try:
        yield control
    except Exception as exc:
        control.fail(exc)
        raise
    finally:
        if task_id:
            with _tasks_lock:
                _tasks.pop(task_id, None)
        _current.reset(token)


def export_operation(fn):
    """Also supports direct service callers, outside the background task API."""
    sig = signature(fn)

    @wraps(fn)
    def run(*args, **kwargs):
        bound = sig.bind(*args, **kwargs)
        bound.apply_defaults()
        with export_scope(bound.arguments.get('fail_fast', True),
                          bound.arguments.get('task_id')):
            return fn(*args, **kwargs)
    return run


def abort_export_task(task_id, error):
    with _tasks_lock:
        control = _tasks.get(task_id)
    if control is not None:
        control.fail(error)


def dependency_failed(message, stage, *, cause=None):
    """Keep explicit partial-export mode; never swallow errors in strict mode."""
    check_export()
    if not strict_export():
        return
    from services.export_service import ExportError
    reason = str(cause) if cause is not None else message
    quota = any(word in reason.lower() for word in (
        'daily', 'quota', 'insufficient', '额度', '余额', 'error [17]', 'error [19]'))
    error = ExportError(
        f'{message}：{reason}' if cause is not None else message,
        error_type=stage, stage=stage,
        error_code='EXPORT_QUOTA_EXHAUSTED' if quota else 'EXPORT_DEPENDENCY_FAILED',
        details={'reason': reason, 'stage': stage},
        help_text=('服务额度已耗尽，请等待额度恢复或联系管理员。' if quota
                   else '本次导出已终止，未生成半成品。请检查错误原因后重新导出。'),
    )
    current_export().fail(error)
    raise error from cause if isinstance(cause, BaseException) else None


def permanent_error(exc):
    status = getattr(exc, 'status_code', None) or getattr(exc, 'code', None)
    response = getattr(exc, 'response', None)
    if status is None and response is not None:
        status = getattr(response, 'status_code', None)
    if status in (400, 401, 403, 404, 405, 422):
        return True
    reason = str(exc).lower()
    return any(marker in reason for marker in (
        'daily request limit', 'daily quota', 'insufficient_quota',
        'insufficient balance', 'quota exhausted', 'invalid api key',
        'invalid_api_key', 'unauthorized', 'permission denied',
        'error [17]', 'error [19]', 'error [110]', 'error [111]',
        '额度耗尽', '余额不足', '鉴权失败', '不支持图片输入',
    ))


def retry_export_request(exc):
    check_export()
    return not (strict_export() and permanent_error(exc))


def export_sleep(seconds):
    control = current_export()
    if control is None:
        time.sleep(seconds)
    else:
        control.stopped.wait(seconds)
        control.check()


def retry_during_export(fn):
    @wraps(fn)
    def run(self, *args, **kwargs):
        if not strict_export():
            return fn(self, *args, **kwargs)
        return export_request(lambda: fn(self, *args, **kwargs),
                              attempts=getattr(self, 'max_attempts', 3))
    return run


def export_request(fn, *args, attempts=3, **kwargs):
    if not strict_export():
        return fn(*args, **kwargs)
    for attempt in range(attempts):
        check_export()
        try:
            result = fn(*args, **kwargs)
            check_export()
            return result
        except Exception as exc:
            if not retry_export_request(exc) or attempt + 1 == attempts:
                raise
            export_sleep(min(2 ** attempt, 10))


class ExportThreadPoolExecutor(VisitorThreadPoolExecutor):
    def submit(self, fn, /, *args, **kwargs):
        control = current_export()
        check_export()

        def run():
            token = _current.set(control)
            try:
                check_export()
                result = fn(*args, **kwargs)
                check_export()
                return result
            except Exception as exc:
                if control is not None and control.strict:
                    control.fail(exc)
                raise
            finally:
                _current.reset(token)

        return super().submit(run)

    def __exit__(self, exc_type, exc, traceback):
        control = current_export()
        if exc is not None and control is not None:
            control.fail(exc)
        aborted = control is not None and control.stopped.is_set()
        self.shutdown(wait=not aborted, cancel_futures=aborted)
        return False


def as_completed(futures):
    if current_export() is None:
        yield from completed(futures)
        return
    pending = set(futures)
    while pending:
        check_export()
        done, pending = wait(pending, timeout=0.05, return_when=FIRST_COMPLETED)
        check_export()
        yield from done
