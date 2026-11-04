#!/usr/bin/env python3
"""Exercise Windows export process ownership, deadlines and packaged dispatch.

Requires only Python and filelock. Optionally pass --worker-exe for a backend
built from banana-slides.spec. No model requests or application data are used.
"""
import argparse
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from filelock import FileLock
from export_runtime.checkpoints import CheckpointStore
from export_runtime.control import ExportDeadline
from export_runtime.process import supervise, WorkerFailed


WORKER = r'''
import json, os, subprocess, sys, time
from pathlib import Path
from filelock import FileLock
from export_runtime.process import monitor_parent
p=json.loads(sys.stdin.readline()); monitor_parent(sys.stdin)
root=Path(p['workspace'])
owner=FileLock(str(root/'owner.lock')); owner.acquire()
slot=FileLock(str(root/'exports-0.lock')); slot.acquire()
(root/'worker.pid').write_text(str(os.getpid()))
child_code="""
import os, sys, time
from pathlib import Path
from filelock import FileLock
root=Path(sys.argv[1])
slot=FileLock(str(root/'descendant.lock')); slot.acquire()
(root/'descendant.pid').write_text(str(os.getpid()))
time.sleep(60)
"""
child=subprocess.Popen([sys.executable,'-c',child_code,str(root)])
until=time.monotonic()+30
while not (root/'descendant.pid').exists():
 if time.monotonic()>until: raise TimeoutError('Descendant did not start')
 time.sleep(.05)
def emit(**event):
 print(json.dumps(dict(protocol=1,**event),ensure_ascii=True),flush=True)
emit(event='running')
if p['case']=='success':
 emit(event='complete',label='ready')
elif p['case']=='failure':
 emit(event='error',message='required dependency failed')
else:
 if p['case']=='deadline':
  emit(event='node_started',node_id='blocked',label='blocked SDK',deadline=time.monotonic()+.5)
 while True:
  emit(event='progress',label='sibling still alive',percent=1)
  time.sleep(.05)
'''


def process_alive(pid):
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = kernel.OpenProcess(0x00100000, False, pid)  # SYNCHRONIZE
    if not handle:
        if ctypes.get_last_error() == 87:  # ERROR_INVALID_PARAMETER: no such PID
            return False
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        return kernel.WaitForSingleObject(handle, 0) == 258  # WAIT_TIMEOUT
    finally:
        kernel.CloseHandle(handle)


def wait_until(predicate, seconds=10):
    end = time.monotonic() + seconds
    while not predicate():
        if time.monotonic() >= end:
            raise TimeoutError('Windows process verification timed out')
        time.sleep(.05)


def assert_cleanup(root):
    pids = [int(path.read_text()) for path in root.glob('*.pid')]
    assert len(pids) == 2, 'Both worker and descendant must have started'
    wait_until(lambda: all(not process_alive(pid) for pid in pids))
    for name in ('owner', 'exports-0', 'descendant'):
        with FileLock(str(root / f'{name}.lock')).acquire(timeout=1):
            pass


def payload(root, case):
    return {'workspace': str(root), 'case': case,
            'queue_deadline_at': time.time() + 45, 'run_timeout': 60}


def execute(request):
    return supervise(request, on_event=lambda _: None, is_active=lambda: True,
                     command=[sys.executable, '-u', '-c', WORKER])


def verify(worker_exe=None):
    assert os.name == 'nt', 'Run this verifier inside Windows'
    results = {}
    with tempfile.TemporaryDirectory(prefix='export-win-') as directory:
        base = Path(directory)
        for case in ('success', 'failure', 'deadline'):
            root = base / case
            started = time.monotonic()
            try:
                execute(payload(root, case))
            except WorkerFailed as error:
                assert case == 'failure' and 'required dependency' in str(error), str(error)
            except ExportDeadline as error:
                assert case == 'deadline' and 'blocked SDK' in str(error), str(error)
            else:
                assert case == 'success'
            assert_cleanup(root)
            results[case] = {'passed': True, 'seconds': round(time.monotonic()-started, 2)}
            print(json.dumps({case: results[case]}), file=sys.stderr, flush=True)

        root = base / 'parent-death'
        parent = subprocess.Popen([sys.executable, str(Path(__file__).resolve()),
                                   '--supervisor', str(root)])
        try:
            try:
                wait_until(lambda: (root / 'descendant.pid').exists(), seconds=30)
            except TimeoutError:
                log = root / 'worker.log'
                print(json.dumps({'supervisor_exit': parent.poll(), 'worker_log':
                      log.read_text(errors='replace')[-3000:] if log.exists() else 'not created'}),
                      file=sys.stderr, flush=True)
                raise
            parent.kill()
            parent.wait(timeout=10)
            assert_cleanup(root)
            results['parent_death'] = {'passed': True}
        finally:
            if parent.poll() is None:
                parent.kill()
                parent.wait(timeout=10)

        # Capacity remains usable after all three failure paths.
        root = base / 'after-failure'
        execute(payload(root, 'success'))
        assert_cleanup(root)
        results['next_worker'] = {'passed': True}

        original = CheckpointStore(base / 'checkpoints-first')
        artifact = original.root / 'background.png'
        artifact.write_bytes(b'validated background fixture')
        original.run('background', {'source': 'fixture'}, lambda: str(artifact))
        resumed = CheckpointStore(base / 'checkpoints-resumed', ancestors=[original.root])
        def duplicate():
            raise AssertionError('Committed artifact should be reused')
        assert resumed.run('background', {'source': 'fixture'}, duplicate) == str(artifact)
        assert resumed.reused == 1
        artifact.write_bytes(b'corrupt')
        replacement = resumed.root / 'replacement.png'
        replacement.write_bytes(b'new background fixture')
        assert resumed.run('background', {'source': 'fixture'}, lambda: str(replacement)) == str(replacement)
        results['checkpoints'] = {'passed': True}

        if worker_exe:
            root = base / '\u6253\u5305\u5165\u53e3'  # Unicode stdin/path through the frozen worker.
            request = {**payload(root, 'package'), 'runtime_dir': str(base / 'capacity'),
                       'pages': [], 'config': {'AI_PROVIDER_FORMAT': 'openai',
                           'OPENAI_API_KEY': 'fixture', 'OPENAI_API_BASE': 'http://127.0.0.1:9/v1'},
                       'options': {'export_mode': 'simple', 'export_extractor_method': 'hybrid',
                           'export_inpaint_method': 'generative', 'max_depth': 1, 'max_workers': 1,
                           'allow_partial': False, 'enable_icon_subject_extraction': False}}
            events = []
            try:
                supervise(request, on_event=events.append, is_active=lambda: True,
                          command=[str(worker_exe), '--editable-export-worker'])
            except WorkerFailed as error:
                # The empty page list deliberately stops before model calls, after
                # loading the real packaged pipeline and its rendering dependencies.
                assert 'list index out of range' in str(error), str(error)
            else:
                raise AssertionError('Expected the empty-input pipeline guard')
            assert any(e['event'] == 'running' for e in events)
            for file in (root/'owner.lock', base/'capacity/exports-0.lock'):
                with FileLock(str(file)).acquire(timeout=1):
                    pass
            results['packaged_dispatch'] = {'passed': True}
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--worker-exe', type=Path)
    parser.add_argument('--supervisor', type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    os.environ['PYTHONPATH'] = str(Path(__file__).resolve().parents[1] / 'backend')
    if args.supervisor:
        execute(payload(args.supervisor, 'parent-death'))
    else:
        print(json.dumps(verify(args.worker_exe), indent=2))
