"""Lightweight entrypoint: queued exports must not load image/model libraries."""
import json
import os
from pathlib import Path
import sys
import threading
import time


def main():
    if sys.platform == 'win32':
        for stream in (sys.stdin, sys.stdout, sys.stderr):
            if stream is not None and hasattr(stream, 'reconfigure'):
                stream.reconfigure(encoding='utf-8', errors='replace')
    if '--parent-sentinel' in sys.argv:
        from export_runtime.process import sentinel_main
        index = sys.argv.index('--parent-sentinel')
        sentinel_main(int(sys.argv[index + 1]), int(sys.argv[index + 2]))
        return
    from filelock import FileLock
    from export_runtime.control import ExportControl
    from export_runtime.process import monitor_parent, PROTOCOL

    payload = json.loads(sys.stdin.readline())
    monitor_parent(sys.stdin)
    output = sys.stdout
    sys.stdout = sys.stderr  # third-party print() cannot corrupt our protocol
    output_lock = threading.Lock()
    config = payload.get('config', {})
    credentials = sorted({value for key, value in config.items()
                          if ('API_KEY' in key or 'TOKEN' in key) and isinstance(value, str) and value},
                         key=len, reverse=True) if config.get('PUBLIC_DEMO') else []

    def redact(value):
        if isinstance(value, str):
            for credential in credentials:
                value = value.replace(credential, '***')
        elif isinstance(value, list):
            return [redact(item) for item in value]
        elif isinstance(value, dict):
            return {key: redact(item) for key, item in value.items()}
        return value

    def emit(event):
        with output_lock:
            safe_event = redact(event) if credentials else event
            output.write(json.dumps({'protocol': PROTOCOL, **safe_event}, ensure_ascii=False) + '\n')
            output.flush()

    root = Path(payload['workspace'])
    root.mkdir(parents=True, exist_ok=True)
    import tempfile
    temporary = root / 'tmp'
    temporary.mkdir(parents=True, exist_ok=True)
    tempfile.tempdir = str(temporary)
    owner = FileLock(str(root / 'owner.lock'))
    try:
        with owner.acquire(timeout=0):
            queued = ExportControl(payload['runtime_dir'], emit=emit,
                                   limits=payload.get('limits'),
                                   run_timeout=max(.01, payload['queue_deadline_at'] - time.time()))
            with queued.bind(), queued.resource('exports'):
                emit({'event': 'running'})
                from export_runtime.pipeline import execute
                result = execute(payload, emit)
                emit({'event': 'complete', **result})
    except BaseException as exc:
        import traceback
        traceback.print_exc(file=sys.stderr)
        emit({'event': 'error', 'message': str(exc), 'error_type': type(exc).__name__,
              'details': exc.to_dict() if hasattr(exc, 'to_dict') else {}})
        output.flush()
        os._exit(1)  # never wait for blocked ThreadPoolExecutor atexit hooks
    output.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
