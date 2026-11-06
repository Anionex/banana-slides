"""Fault tests exercise the real process, locking and checkpoint boundaries."""
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import sys
import subprocess
import threading
import time

import pytest

from export_runtime.checkpoints import CheckpointStore, atomic_json
from export_runtime.control import ExportControl, ExportExecutor, ExportDeadline, as_completed, request
from export_runtime.process import supervise


def test_strict_failure_does_not_wait_for_blocked_sibling(tmp_path):
    held = threading.Event()
    started = threading.Event()
    control = ExportControl(tmp_path)
    def blocked():
        started.set()
        held.wait(3)
    def failure():
        assert started.wait(1)
        raise RuntimeError('quota exhausted')
    start = time.monotonic()
    try:
        with pytest.raises(RuntimeError, match='quota exhausted'), control.bind():
            with ExportExecutor(max_workers=2) as pool:
                jobs = [pool.submit(blocked), pool.submit(failure)]
                list(as_completed(jobs))
        assert time.monotonic() - start < 1
        assert control.stopped.is_set()
    finally:
        held.set()


def test_packaged_entry_dispatch_exits_before_loading_server(monkeypatch):
    import runpy
    from types import ModuleType
    worker = ModuleType('export_worker')
    calls = []
    worker.main = lambda: calls.append('worker')
    monkeypatch.setitem(sys.modules, 'export_worker', worker)
    monkeypatch.setattr(sys, 'argv', ['banana-slides', '--editable-export-worker', '--parent-sentinel'])
    with pytest.raises(SystemExit) as exited:
        runpy.run_path(str(Path(__file__).parents[2] / 'app.py'), run_name='__main__')
    assert exited.value.code == 0
    assert calls == ['worker']


def test_worker_oauth_uses_snapshot_without_database(monkeypatch):
    from flask import Flask
    from models import Settings
    from services.ai_providers import _get_openai_oauth_token
    def forbidden():
        raise AssertionError('The isolated worker must not read the application database')
    monkeypatch.setattr(Settings, 'get_settings', forbidden)
    app = Flask('oauth-worker-test')
    app.config.update(EXPORT_WORKER=True, EXPORT_OAUTH_TOKEN='fixture-oauth')
    with app.app_context():
        assert _get_openai_oauth_token() == 'fixture-oauth'


def test_caption_endpoint_change_retains_image_identity():
    from export_runtime.pipeline import fingerprints
    options = {'export_mode': 'simple', 'export_extractor_method': 'hybrid',
               'export_inpaint_method': 'generative', 'max_depth': 1,
               'enable_icon_subject_extraction': False}
    config = {'IMAGE_MODEL': 'image', 'IMAGE_CAPTION_MODEL': 'caption',
              'IMAGE_API_BASE': 'http://image', 'IMAGE_CAPTION_API_BASE': 'http://caption',
              'IMAGE_API_KEY': 'fixture-secret'}
    original = fingerprints(config, options)
    updated = fingerprints({**config, 'IMAGE_CAPTION_API_BASE': 'http://caption-new'}, options)
    assert original['candidate'] == updated['candidate']
    for stage in ('review', 'target_review', 'global_style', 'local_style', 'background', 'analysis'):
        assert original[stage] != updated[stage]
    assert 'fixture-secret' not in json.dumps(original)


def test_permanent_error_is_not_retried_even_in_partial_mode(tmp_path):
    calls = []
    def fail():
        calls.append(1)
        error = RuntimeError('payment required')
        error.status_code = 402
        raise error
    with ExportControl(tmp_path, strict=False).bind(), pytest.raises(RuntimeError):
        request('image', fail)
    assert len(calls) == 1


def test_checkpoint_resume_verifies_artifact_and_ignores_torn_commit(tmp_path):
    old, new = tmp_path / 'old', tmp_path / 'new'
    old.mkdir()
    source = old / 'image.png'
    source.write_bytes(b'accepted-background')
    first = CheckpointStore(old)
    key = first.key('background', {'page': 'sha'})
    first.commit('background', key, str(source))
    resumed = CheckpointStore(new, ancestors=[old])
    assert resumed.run('background', {'page': 'sha'}, lambda: pytest.fail('regenerated')) == str(source)
    source.write_bytes(b'corrupted')
    calls = []
    def regenerate():
        calls.append(1)
        replacement = new / 'replacement.png'
        replacement.write_bytes(b'new-value')
        return str(replacement)
    assert resumed.run('background', {'page': 'sha'}, regenerate) == str(new / 'replacement.png')
    assert calls == [1]
    (new / 'nodes' / 'background' / f'{key}.json').write_text('{unfinished')
    assert resumed.run('background', {'page': 'sha'}, regenerate) == str(new / 'replacement.png')
    assert calls == [1, 1]


def test_duplicate_nodes_are_computed_once_and_model_changes_invalidate(tmp_path):
    store = CheckpointStore(tmp_path, fingerprints={'local_style': {'model': 'a'}})
    calls = []
    def compute():
        calls.append(1)
        time.sleep(.03)
        return {'color': 'blue'}
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: store.run('local_style', {'text': 'hello'}, compute), range(16)))
    assert len(calls) == 1 and len(results) == 16
    changed = CheckpointStore(tmp_path, fingerprints={'local_style': {'model': 'b'}})
    changed.run('local_style', {'text': 'hello'}, compute)
    assert len(calls) == 2


def test_failed_stage_is_not_checkpointed(tmp_path):
    store = CheckpointStore(tmp_path)
    assert store.run('background', {}, lambda: None) is None
    assert not list(tmp_path.rglob('*.json'))


def test_supervisor_hard_node_deadline_ignores_sibling_heartbeats(tmp_path):
    script = '''
import json, os, sys, time
payload=json.loads(sys.stdin.readline())
open(payload['workspace']+'/pid','w').write(str(os.getpid()))
def emit(**event): print(json.dumps(dict(protocol=1, **event)), flush=True)
emit(event='running')
emit(event='node_started',node_id='blocked',label='blocked SDK',deadline=time.monotonic()+.2)
while True:
 emit(event='progress',label='other node still alive',percent=1)
 time.sleep(.02)
'''
    payload = {'workspace': str(tmp_path), 'queue_deadline_at': time.time() + 5, 'run_timeout': 5}
    started = time.monotonic()
    with pytest.raises(ExportDeadline, match='blocked SDK'):
        supervise(payload, on_event=lambda _: None, is_active=lambda: True,
                  command=[sys.executable, '-u', '-c', script])
    assert time.monotonic() - started < 2
    if os.name != 'nt':
        with pytest.raises(ProcessLookupError):
            os.kill(int((tmp_path / 'pid').read_text()), 0)


def test_supervisor_handles_worker_exit_without_complete(tmp_path):
    with pytest.raises(Exception, match='意外退出'):
        supervise({'workspace': str(tmp_path), 'queue_deadline_at': time.time() + 5},
                  on_event=lambda _: None, is_active=lambda: True,
                  command=[sys.executable, '-c', 'import sys; sys.stdin.readline()'])


def test_abort_rejects_late_checkpoint_commit(tmp_path):
    control = ExportControl(tmp_path)
    store = CheckpointStore(tmp_path)
    with control.bind():
        control.fail(RuntimeError('stopped'))
        with pytest.raises(RuntimeError, match='stopped'):
            store.commit('background', 'key', 'result')
    assert not list(tmp_path.rglob('*.json'))


def test_text_that_looks_like_a_filename_is_not_a_file_dependency(tmp_path):
    store = CheckpointStore(tmp_path)
    value = {'text': 'README.md', 'source': 'baidu_accurate_ocr', 'metadata': {'path': 'Roadmap'}}
    assert store.run('local_style', value, lambda: value) == value
    assert store.run('local_style', value, lambda: pytest.fail('cache miss')) == value


def test_duplicate_node_wait_has_an_absolute_deadline(tmp_path):
    store = CheckpointStore(tmp_path)
    key = store.key('local_style', {})
    lock = store._locks[key] = threading.Lock()
    lock.acquire()
    try:
        with ExportControl(tmp_path / 'runtime', node_timeout=.1).bind(), pytest.raises(ExportDeadline):
            store.run('local_style', {}, lambda: None)
    finally:
        lock.release()


@pytest.mark.skipif(os.name == 'nt', reason='POSIX native GIL/parent-death regression')
def test_parent_death_kills_gil_blocked_worker_and_releases_capacity(tmp_path):
    from filelock import FileLock
    from export_runtime.tasks import owner_alive
    child = r'''
import ctypes, json, os, sys
from filelock import FileLock
from export_runtime.process import monitor_parent
p=json.loads(sys.stdin.readline())
owner=FileLock(p['workspace']+'/owner.lock'); owner.acquire()
slot=FileLock(p['workspace']+'/exports-0.lock'); slot.acquire()
monitor_parent(sys.stdin)
open(p['workspace']+'/pid','w').write(str(os.getpid()))
ctypes.PyDLL(None).sleep(60)
'''
    parent = '''
import json, sys, time
from export_runtime.process import supervise
p=json.loads(sys.argv[1]); supervise(p,on_event=lambda _:None,is_active=lambda:True,
command=[sys.executable,'-u','-c',sys.argv[2]])
'''
    payload = {'workspace': str(tmp_path), 'queue_deadline_at': time.time() + 60}
    env = {**os.environ, 'PYTHONPATH': str(Path(__file__).parents[2])}
    process = subprocess.Popen([sys.executable, '-c', parent, json.dumps(payload), child], env=env,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    worker_pid = None
    try:
        deadline = time.monotonic() + 5
        while not (tmp_path / 'pid').exists() and time.monotonic() < deadline:
            time.sleep(.02)
        worker_pid = int((tmp_path / 'pid').read_text())
        assert owner_alive(tmp_path)
        process.kill()
        process.wait(3)
        deadline = time.monotonic() + 3
        while owner_alive(tmp_path) and time.monotonic() < deadline:
            time.sleep(.02)
        assert not owner_alive(tmp_path), 'Sentinel must run despite the worker holding the GIL'
        with FileLock(str(tmp_path / 'exports-0.lock')).acquire(timeout=0):
            pass
    finally:
        if process.poll() is None:
            process.kill()
        process.wait(3)
        if worker_pid:
            try:
                os.killpg(worker_pid, 9)
            except (ProcessLookupError, PermissionError):
                pass


def test_remote_job_invalidation_shadows_all_ancestors(tmp_path):
    parent = CheckpointStore(tmp_path / 'first')
    parent.run('image_submission', {'prompt': 'erase'}, lambda: {'task_id': 'job-1'})
    second = CheckpointStore(tmp_path / 'second', ancestors=[parent.root])
    second.invalidate('image_submission', {'prompt': 'erase'})
    third = CheckpointStore(tmp_path / 'third', ancestors=[second.root, parent.root])
    assert third.run('image_submission', {'prompt': 'erase'}, lambda: {'task_id': 'job-2'}) == {'task_id': 'job-2'}


def test_exports_start_even_when_general_generation_pool_is_saturated():
    from services.task_manager import TaskManager
    manager = TaskManager(max_workers=1)
    released = threading.Event()
    started = threading.Event()
    def generation(_task_id):
        started.set()
        released.wait(3)
    def export(_task_id):
        return 'export started'
    export._dedicated_export_supervisor = True
    try:
        manager.submit_task('generation', generation)
        assert started.wait(1)
        manager.submit_task('export', export)
        # Fast completion may already have removed the Future from active_tasks.
        future = manager.active_tasks.get('export')
        if future:
            assert future.result(timeout=1) == 'export started'
        assert not released.is_set()
    finally:
        released.set()
        manager.executor.shutdown(wait=True)


def test_hybrid_extraction_error_aborts_without_waiting_for_other_extractor(tmp_path):
    from types import SimpleNamespace
    from services.image_editability.extractors import ExtractionResult
    from services.image_editability.hybrid_extractor import HybridElementExtractor
    blocked = threading.Event()
    started = threading.Event()
    def wait_forever(*_args, **_kwargs):
        started.set()
        blocked.wait(3)
        return ExtractionResult([])
    def fail_result(*_args, **_kwargs):
        assert started.wait(1)
        return ExtractionResult([], error='required OCR failed')
    extractor = HybridElementExtractor(SimpleNamespace(extract=wait_forever), SimpleNamespace(extract=fail_result))
    start = time.monotonic()
    try:
        with ExportControl(tmp_path).bind(), pytest.raises(RuntimeError, match='required OCR failed'):
            extractor.extract('unused.png')
        assert time.monotonic() - start < 1
    finally:
        blocked.set()


def test_configured_hybrid_enhancement_failure_propagates(tmp_path):
    from types import SimpleNamespace
    from PIL import Image
    from services.image_editability.inpaint_providers import HybridInpaintProvider
    source = Image.new('RGB', (20, 20), 'white')
    provider = HybridInpaintProvider(SimpleNamespace(inpaint_regions=lambda **kw: source), object())
    provider._enhance_image_quality = lambda *args, **kwargs: None
    with ExportControl(tmp_path).bind(), pytest.raises(RuntimeError, match='画质提升'):
        provider.inpaint_regions(source, [(0, 0, 10, 10)])


def test_local_model_initialization_and_inference_share_single_capacity(tmp_path, monkeypatch):
    import numpy as np
    from PIL import Image
    from types import SimpleNamespace
    from services.ai_providers.image.rmbg_segmentation_provider import RmbgSegmentationProvider
    provider = RmbgSegmentationProvider()
    counter = {'active': 0, 'peak': 0}
    mutex = threading.Lock()
    def counted():
        with mutex:
            counter['active'] += 1
            counter['peak'] = max(counter['peak'], counter['active'])
        time.sleep(.01)
        with mutex:
            counter['active'] -= 1
    def inference(*_args):
        counted()
        return [np.ones((8, 8), dtype=np.float32)]
    monkeypatch.setattr(provider, '_ensure_session', counted)
    provider._session = SimpleNamespace(run=inference)
    provider._input_name = 'image'
    image = Image.new('RGB', (20, 20), 'blue')
    with ExportControl(tmp_path).bind(), ExportExecutor(max_workers=4) as pool:
        results = [pool.submit(provider.extract_subject, image) for _ in range(8)]
        assert all(job.result() is not None for job in results)
    assert counter['peak'] == 1
