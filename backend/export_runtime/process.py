"""Disposable export workers: bounded queue/run/node waits and process reaping."""
import json
import os
from pathlib import Path
import queue
import signal
import subprocess
import sys
import threading
import time

from .control import ExportAborted, ExportDeadline

PROTOCOL = 1


class WorkerFailed(ExportAborted):
    def __init__(self, event):
        super().__init__(event.get('message') or '导出失败')
        self.details = event.get('details') or {}


def worker_command():
    if getattr(sys, 'frozen', False):
        return [sys.executable, '--editable-export-worker']
    return [sys.executable, str(Path(__file__).resolve().parents[1] / 'export_worker.py')]


def terminate_tree(process):
    """Always reap our child; POSIX group also covers helper subprocesses."""
    if os.name == 'nt':
        if process.poll() is None:
            subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                           capture_output=True, timeout=10, check=False)
            if process.poll() is None:
                process.kill()
    else:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        except PermissionError:
            # Darwin can return EPERM for an already-reaped owned group. Only
            # absence proven by pgrep permits treating this as cleaned up.
            probe = subprocess.run(['/usr/bin/pgrep', '-g', str(process.pid)], capture_output=True, timeout=2)
            if probe.returncode != 1:
                raise
    process.wait(timeout=10)


def supervise(payload, *, on_event, is_active, command=None):
    root = Path(payload['workspace'])
    root.mkdir(parents=True, exist_ok=True)
    events = queue.Queue()
    queue_deadline = time.monotonic() + max(0, payload['queue_deadline_at'] - time.time())
    run_deadline = None
    nodes = {}
    result = None
    reader_done = threading.Event()
    with (root / 'worker.log').open('a', encoding='utf-8') as log:
        process = subprocess.Popen(command or worker_command(), stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=log, text=True,
                                   encoding='utf-8', bufsize=1, close_fds=True,
                                   start_new_session=os.name != 'nt')
        job = None
        if os.name == 'nt':
            try:
                from .windows_job import WindowsJob
                job = WindowsJob(process)
            except BaseException:
                terminate_tree(process)
                raise

        def read_events():
            try:
                for line in process.stdout:
                    try:
                        event = json.loads(line)
                        if not isinstance(event, dict) or event.get('protocol') != PROTOCOL:
                            raise ValueError('Unknown export worker protocol')
                        events.put(event)
                    except (ValueError, TypeError):
                        events.put({'event': 'error', 'message': '导出 worker 通信格式错误'})
            finally:
                reader_done.set()

        reader = threading.Thread(target=read_events, name='export-events', daemon=True)
        reader.start()
        last_pulse = 0
        try:
            process.stdin.write(json.dumps(payload, ensure_ascii=False) + '\n')
            process.stdin.flush()
            while True:
                now = time.monotonic()
                if not is_active():
                    raise ExportAborted('导出任务已终止')
                if now >= (run_deadline or queue_deadline):
                    raise ExportDeadline('导出执行超时' if run_deadline else '导出排队超时')
                expired = next((label for label, deadline in nodes.values() if now >= deadline), None)
                if expired:
                    raise ExportDeadline(f'导出步骤超时：{expired}')
                if now - last_pulse >= 1 and process.poll() is None:
                    try:
                        process.stdin.write('pulse\n')
                        process.stdin.flush()
                    except BrokenPipeError:
                        pass  # Drain the worker's final event before checking its exit.
                    last_pulse = now
                try:
                    event = events.get(timeout=.05)
                except queue.Empty:
                    if process.poll() is not None and reader_done.is_set():
                        raise ExportAborted(f'导出 worker 意外退出（exit={process.returncode}）')
                    continue
                kind = event.get('event')
                if kind == 'running':
                    run_deadline = now + float(payload.get('run_timeout', 3600))
                elif kind == 'node_started':
                    nodes[event['node_id']] = (event['label'], float(event['deadline']))
                elif kind == 'node_finished':
                    nodes.pop(event['node_id'], None)
                elif kind == 'error':
                    if event.get('error_type') == 'ExportDeadline':
                        raise ExportDeadline(event.get('message') or '导出执行超时')
                    raise WorkerFailed(event)
                elif kind == 'complete':
                    result = event
                    break
                on_event(event)
            return result
        finally:
            if job:
                job.close()
                process.wait(timeout=10)
            else:
                terminate_tree(process)
            try:
                process.stdin.close()
            except BrokenPipeError:
                pass
            reader.join(timeout=2)
            process.stdout.close()


def monitor_parent(pipe):
    """An independent sentinel remains schedulable even if the worker holds GIL."""
    command = worker_command() + ['--parent-sentinel', str(os.getpid()), str(os.getpgrp() if os.name != 'nt' else os.getpid())]
    return subprocess.Popen(command, stdin=pipe, stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL, close_fds=True)


def sentinel_main(worker_pid, process_group):
    last_pulse = [time.monotonic()]
    closed = threading.Event()

    def read():
        for line in sys.stdin:
            if line.strip() == 'pulse':
                last_pulse[0] = time.monotonic()
        closed.set()

    threading.Thread(target=read, daemon=True).start()
    while not closed.wait(.1):
        if time.monotonic() - last_pulse[0] > 15:
            break
        # Windows interprets signal 0 as CTRL_C_EVENT, not a liveness probe.
        # Its job object already owns the worker/sentinel lifetime together.
        if os.name != 'nt':
            try:
                os.kill(worker_pid, 0)
            except ProcessLookupError:
                return
    if os.name == 'nt':
        subprocess.run(['taskkill', '/PID', str(worker_pid), '/T', '/F'],
                       capture_output=True, timeout=10, check=False)
    else:
        try:
            os.killpg(process_group, signal.SIGKILL)
        except ProcessLookupError:
            pass
