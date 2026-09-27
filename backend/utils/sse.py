"""Keep a blocking AI stream responsive without sharing Flask/DB contexts."""
from queue import Empty, Full, Queue
from threading import Event
from time import monotonic

from services.public_demo import VisitorThread
from services.ai_providers.text.stream_control import stream_limits


def with_heartbeat(generate, *, interval=10, idle_timeout=300):
    """Yield immediately and while waiting; stop delivery after disconnect/timeout.

    The producer owns its app context and generator. VisitorThread carries only
    the existing visitor snapshot, never the request's SQLAlchemy session.
    """
    queue = Queue(maxsize=1)
    stopped = Event()
    end = object()

    def send(item):
        while not stopped.is_set():
            try:
                queue.put(item, timeout=0.1)
                return
            except Full:
                pass

    def produce():
        source = generate(stopped)
        try:
            # SDK reads must finish before the UI idle deadline; retries are disabled
            # within this request-local scope, never on a shared provider/client.
            with stream_limits(min(240, idle_timeout * 0.8), stopped):
                for chunk in source:
                    if stopped.is_set():
                        break
                    send(chunk)
        except Exception as exc:
            send(exc)
        finally:
            source.close()
            send(end)

    worker = VisitorThread(target=produce, daemon=True, name='outline-sse')
    worker.start()
    last_event = monotonic()
    try:
        yield ': keep-alive\n\n'
        while True:
            remaining = idle_timeout - (monotonic() - last_event)
            if remaining <= 0:
                stopped.set()
                yield 'event: error\ndata: {"message":"模型长时间未返回大纲，请稍后重试。 / The model timed out. Please try again."}\n\n'
                return
            try:
                item = queue.get(timeout=min(interval, remaining))
            except Empty:
                yield ': keep-alive\n\n'
                continue
            if item is end:
                return
            if isinstance(item, Exception):
                raise item
            last_event = monotonic()
            yield item
    finally:
        # A blocking provider is bounded by its SDK timeout. Once it yields,
        # the producer closes its own generator and releases its DB session.
        stopped.set()
