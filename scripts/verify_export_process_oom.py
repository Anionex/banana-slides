#!/usr/bin/env python3
"""Run inside a disposable Linux cgroup capped at 128 MiB (never on the host).

Only stdlib + filelock are needed. Deliberately OOM one worker, then verify its
owner/capacity locks are free and a second export worker can finish normally.
"""
import json
import os
from pathlib import Path
import sys
import tempfile
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from filelock import FileLock
from export_runtime.control import ExportAborted
from export_runtime.process import supervise


def main():
    cgroup = Path('/sys/fs/cgroup')
    limit = (cgroup / 'memory.max').read_text().strip()
    if not limit.isdigit() or not 96 * 1024**2 <= int(limit) <= 128 * 1024**2:
        raise SystemExit('Requires an isolated cgroup memory.max between 96 and 128 MiB')
    def oom_kills():
        return int(dict(line.split() for line in (cgroup / 'memory.events').read_text().splitlines())['oom_kill'])
    before = oom_kills()
    with tempfile.TemporaryDirectory(prefix='export-oom-') as root:
        child = '''
import json, os, sys, time
from filelock import FileLock
from export_runtime.process import monitor_parent
p=json.loads(sys.stdin.readline()); monitor_parent(sys.stdin)
owner=FileLock(p['workspace']+'/owner.lock'); owner.acquire()
slot=FileLock(p['workspace']+'/exports-0.lock'); slot.acquire()
print(json.dumps(dict(protocol=1,event='running')),flush=True)
if p.get('oom'):
 chunks=[]
 for _ in range(64):
  chunks.append(bytearray(4*1024*1024))
  time.sleep(.01)
else:
 print(json.dumps(dict(protocol=1,event='complete',worker_pid=os.getpid())),flush=True)
'''
        payload = {'workspace': root, 'queue_deadline_at': time.time() + 15,
                   'run_timeout': 15, 'oom': True}
        started = time.monotonic()
        try:
            supervise(payload, on_event=lambda _: None, is_active=lambda: True,
                      command=[sys.executable, '-u', '-c', child])
        except ExportAborted as error:
            assert 'exit=-9' in str(error), str(error)
        else:
            raise AssertionError('Expected worker OOM')
        assert oom_kills() > before, 'Kernel must confirm an actual OOM kill'
        for name in ('owner', 'exports-0'):
            with FileLock(str(Path(root) / f'{name}.lock')).acquire(timeout=0):
                pass
        result = supervise({**payload, 'oom': False}, on_event=lambda _: None, is_active=lambda: True,
                           command=[sys.executable, '-u', '-c', child])
        try:
            os.kill(result['worker_pid'], 0)
        except ProcessLookupError:
            pass
        else:
            raise AssertionError('Successful worker was not reaped')
        print(json.dumps({'memory_limit_bytes': int(limit), 'kernel_oom_kills': oom_kills() - before,
                          'locks_released': True, 'next_worker_completed': True,
                          'elapsed_seconds': round(time.monotonic() - started, 2)}))


if __name__ == '__main__':
    main()
