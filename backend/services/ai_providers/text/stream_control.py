"""Request-local limits for outline SDK streams; shared clients stay unchanged."""
from contextlib import contextmanager
from contextvars import ContextVar

_control = ContextVar('text_stream_control', default=None)


@contextmanager
def stream_limits(timeout, stopped):
    token = _control.set((timeout, stopped))
    try:
        yield
    finally:
        _control.reset(token)


def stream_timeout():
    control = _control.get()
    return control[0] if control else None


def stream_stopped():
    control = _control.get()
    return control is not None and control[1].is_set()
