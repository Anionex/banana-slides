"""Cancellation, deadlines and deployment-wide capacity for editable exports.

Threads cooperate; the supervisor supplies the hard process termination boundary.
Native file locks are held by the process doing the actual work, not its parent.
"""
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
from contextlib import contextmanager, nullcontext
from contextvars import ContextVar, copy_context
from functools import wraps
from pathlib import Path
import random
import threading
import time
import uuid

from filelock import FileLock, Timeout

_current = ContextVar('export_runtime', default=None)
_held = ContextVar('export_resources', default=frozenset())
_request_owner = ContextVar('export_request_owner', default=None)
DEFAULT_LIMITS = {'exports': 1, 'pages': 4, 'caption': 8, 'image': 4, 'ocr': 2, 'inference': 1}


class ExportAborted(RuntimeError):
    """A terminal execution failure; never convert to a partial result."""


class ExportDeadline(ExportAborted):
    pass


class StageFailure(RuntimeError):
    """A required stage did not produce a usable result."""


class RemoteJobFailed(StageFailure):
    """A known remote job reached a failed terminal state; do not resubmit it."""
    permanent = True


def current():
    return _current.get()


def check():
    control = current()
    if control:
        control.check()


class ExportControl:
    def __init__(self, runtime_dir, *, strict=True, emit=None, limits=None,
                 node_timeout=600, run_timeout=3600, store=None):
        self.runtime_dir = Path(runtime_dir)
        self.runtime_dir.mkdir(parents=True, exist_ok=True)
        self.strict = strict
        self.emit = emit or (lambda event: None)
        self.limits = {**DEFAULT_LIMITS, **(limits or {})}
        self.node_timeout = float(node_timeout)
        self.deadline = time.monotonic() + float(run_timeout)
        self.stopped = threading.Event()
        self.lock = threading.RLock()
        self.error = None
        self.nodes = {}
        self.store = store

    def fail(self, error):
        with self.lock:
            if self.error is None:
                self.error = error
                self.stopped.set()

    def check(self):
        with self.lock:
            now = time.monotonic()
            expired = next((n for n, deadline in self.nodes.values() if now >= deadline), None)
            if now >= self.deadline or expired:
                self.fail(ExportDeadline(f'导出执行超时：{expired or "任务总时限"}'))
            if self.error is not None:
                raise self.error

    @contextmanager
    def bind(self):
        token = _current.set(self)
        try:
            self.check()
            yield self
        finally:
            _current.reset(token)

    @contextmanager
    def node(self, label, timeout=None):
        self.check()
        node_id = uuid.uuid4().hex
        deadline = min(self.deadline, time.monotonic() + (timeout or self.node_timeout))
        with self.lock:
            self.nodes[node_id] = (label, deadline)
        self.emit({'event': 'node_started', 'node_id': node_id,
                   'label': label, 'deadline': deadline})
        try:
            yield
            self.check()
        finally:
            with self.lock:
                self.nodes.pop(node_id, None)
            self.emit({'event': 'node_finished', 'node_id': node_id})

    @contextmanager
    def resource(self, name):
        if name in _held.get():
            yield  # Nested adapter wrappers must not reacquire the same resource.
            return
        self.check()
        limit = max(1, int(self.limits[name]))
        slot = None
        started = time.monotonic()
        announced = False
        while slot is None:
            self.check()
            for index in range(limit):
                candidate = FileLock(str(self.runtime_dir / f'{name}-{index}.lock'))
                try:
                    candidate.acquire(timeout=0)
                    slot = candidate
                    break
                except Timeout:
                    pass
            if slot is None:
                if not announced and time.monotonic() - started > 0.5:
                    self.emit({'event': 'waiting', 'label': f'等待 {name} 执行额度'})
                    announced = True
                self.stopped.wait(.05)
        token = _held.set(_held.get() | {name})
        try:
            self.check()
            yield
            self.check()
        finally:
            _held.reset(token)
            slot.release()


def sleep(seconds):
    control = current()
    if control:
        control.stopped.wait(max(0, min(seconds, control.deadline - time.monotonic())))
        control.check()
    else:
        time.sleep(seconds)


def permanent_error(exc):
    if getattr(exc, 'permanent', False):
        return True
    status = getattr(exc, 'status_code', None)
    response = getattr(exc, 'response', None)
    if status is None and response is not None:
        status = getattr(response, 'status_code', None)
    if status in (400, 401, 402, 403, 404, 405, 422):
        return True
    reason = str(exc).lower()
    return any(marker in reason for marker in (
        'daily request limit', 'daily quota', 'insufficient_quota', 'insufficient balance',
        'quota exhausted', 'invalid api key', 'invalid_api_key', 'unauthorized',
        'permission denied', 'error [17]', 'error [19]', 'error [110]', 'error [111]',
        '余额不足', '额度耗尽', '鉴权失败', '不支持图片输入',
    ))


def request(resource, fn, *, attempts=3):
    """Single application retry owner, within one absolute node deadline."""
    control = current()
    if control is None:
        return fn()
    if _request_owner.get():
        with control.resource(resource):
            return fn()
    with control.node(resource):
        for attempt in range(attempts):
            control.check()
            try:
                with control.resource(resource):
                    token = _request_owner.set(resource)
                    try:
                        return fn()
                    finally:
                        _request_owner.reset(token)
            except ExportAborted:
                raise
            except Exception as exc:
                control.check()
                if permanent_error(exc) or attempt + 1 == attempts:
                    raise
                control.emit({'event': 'retry', 'label': resource,
                              'attempt': attempt + 2, 'max_attempts': attempts})
                sleep(min(2 ** attempt, 8) + random.uniform(0, .25))


def dependency_failed(message, cause=None):
    check()
    control = current()
    if control and control.strict:
        error = StageFailure(f'{message}: {cause}' if cause else message)
        control.fail(error)
        raise error from cause if isinstance(cause, Exception) else None


class ExportExecutor(ThreadPoolExecutor):
    """Propagate execution and Flask context; abort without joining siblings."""
    def submit(self, fn, /, *args, **kwargs):
        check()
        context = copy_context()
        control = current()
        from flask import has_app_context, current_app
        app = current_app._get_current_object() if has_app_context() else None

        def run():
            with app.app_context() if app else nullcontext():
                try:
                    check()
                    result = fn(*args, **kwargs)
                    check()
                    return result
                except Exception as exc:
                    if control and (control.strict or isinstance(exc, ExportAborted)):
                        control.fail(exc)
                    raise
        return super().submit(context.run, run)

    def __exit__(self, exc_type, exc, tb):
        control = current()
        if exc is not None and control:
            control.fail(exc)
        self.shutdown(wait=exc is None and not (control and control.stopped.is_set()),
                      cancel_futures=True)
        return False


def as_completed(futures):
    pending = set(futures)
    while pending:
        check()
        done, pending = wait(pending, timeout=.05, return_when=FIRST_COMPLETED)
        check()
        yield from done


def operation(fn):
    """Direct Python callers get cooperative fail-fast too, without persistence."""
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if current():
            return fn(*args, **kwargs)
        import tempfile
        from inspect import signature
        bound = signature(fn).bind(*args, **kwargs)
        bound.apply_defaults()
        control = ExportControl(Path(tempfile.gettempdir()) / 'banana-export-direct',
                                strict=bound.arguments.get('fail_fast', True))
        with control.bind():
            try:
                return fn(*args, **kwargs)
            except BaseException as exc:
                control.fail(exc)
                raise
    return wrapped


def export_call(resource, attempts=3):
    """Bypass legacy Tenacity retry wrappers inside an export only."""
    def decorate(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            if current() is None:
                return fn(*args, **kwargs)
            target = fn.__wrapped__ if hasattr(fn, 'retry') else fn
            return request(resource, lambda: target(*args, **kwargs), attempts=attempts)
        return wrapped
    return decorate
