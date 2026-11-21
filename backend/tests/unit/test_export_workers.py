"""Real disposable processes and HTTP requests; no external model is used here."""
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import sys
import threading
import time

from PIL import Image, ImageDraw
from pptx import Presentation
import pytest

from export_runtime.checkpoints import file_hash
from export_runtime.process import supervise, WorkerFailed
from export_runtime.tasks import owner_alive


@pytest.fixture
def provider_server():
    state = {'active': {}, 'peak': {}, 'calls': [], 'fail': None}
    lock = threading.Lock()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            kind = body['kind']
            with lock:
                state['calls'].append(body)
                state['active'][kind] = state['active'].get(kind, 0) + 1
                state['peak'][kind] = max(state['peak'].get(kind, 0), state['active'][kind])
                failed = state['fail'] and all(body.get(k) == v for k, v in state['fail'].items())
            time.sleep(.06)
            with lock:
                state['active'][kind] -= 1
            self.send_response(402 if failed else 200)
            self.end_headers()
            try:
                self.wfile.write(b'payment required' if failed else b'{}')
            except BrokenPipeError:
                pass
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f'http://127.0.0.1:{server.server_port}', state
    server.shutdown()
    server.server_close()
    thread.join(2)


def payload(root, server_url, *, count=24, mode='simple'):
    sources = root / 'originals'
    sources.mkdir(parents=True, exist_ok=True)
    pages = []
    for index in range(count):
        path = sources / f'{index}.png'
        image = Image.new('RGB', (320, 180), 'white')
        ImageDraw.Draw(image).text((20, 20), f'Page {index + 1}', fill='black')
        image.putpixel((0, 0), (index + 1, 0, 0))
        image.save(path)
        pages.append({'id': str(index), 'path': str(path), 'sha256': file_hash(path)})
    return {'workspace': str(root / 'run'), 'runtime_dir': str(root.parent / 'shared-slots'),
            'queue_deadline_at': time.time() + 30, 'run_timeout': 60, 'node_timeout': 20,
            'fixture_url': server_url, 'pages': pages,
            'limits': {'exports': 2, 'pages': 4, 'image': 2, 'caption': 3, 'ocr': 2},
            'config': {'AI_PROVIDER_FORMAT': 'openai', 'OPENAI_API_BASE': server_url,
                       'IMAGE_MODEL': 'fixture-image', 'IMAGE_CAPTION_MODEL': 'fixture-caption'},
            'options': {'export_mode': mode, 'max_depth': 2 if mode == 'full' else 1,
                        'max_workers': 4, 'allow_partial': False,
                        'export_extractor_method': 'hybrid', 'export_inpaint_method': 'generative',
                        'enable_icon_subject_extraction': False}}


def run(request, events=None):
    return supervise(request, on_event=(events if events is not None else []).append,
        is_active=lambda: True,
        command=[sys.executable, str(Path(__file__).parents[1] / 'fixtures/export_runtime_worker.py')])


@pytest.mark.skipif(os.name == 'nt', reason='Fixture peak RSS measurement uses POSIX getrusage')
@pytest.mark.parametrize('mode', ['simple', 'full'])
def test_two_24_page_exports_share_capacity_and_release_processes(tmp_path, provider_server, mode):
    url, state = provider_server
    requests = [payload(tmp_path / name, url, mode=mode) for name in ('first', 'second')]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, requests))
    assert set(state['peak']) == {'image', 'caption', 'ocr'}
    assert all(state['peak'][kind] <= limit for kind, limit in {'image': 2, 'caption': 3, 'ocr': 2}.items())
    assert state['peak']['image'] == 2  # Exercise contention rather than a serial pass.
    for request, result in zip(requests, results):
        deck = Presentation(result['path'])
        assert len(deck.slides) == 24
        assert [next(shape.text for shape in slide.shapes if shape.has_text_frame) for slide in deck.slides] == [f'Page {i}' for i in range(1, 25)]
        assert result['peak_rss_bytes'] > 0
        assert not owner_alive(request['workspace'])
        with pytest.raises(ProcessLookupError):
            os.kill(result['worker_pid'], 0)
    print(json.dumps({'mode': mode, 'pages_per_export': 24, 'exports': 2, 'peak_requests': state['peak'],
                      'peak_rss_bytes': [item['peak_rss_bytes'] for item in results]}))


@pytest.mark.parametrize('mode', ['simple', 'full'])
def test_failed_styles_resume_after_process_restart_without_repeating_images(tmp_path, provider_server, mode):
    url, state = provider_server
    request = payload(tmp_path / mode, url, count=3, mode=mode)
    state['fail'] = {'kind': 'caption', 'phase': 'global', 'page': 2}
    with pytest.raises(WorkerFailed):
        run(request)
    assert not (Path(request['workspace']) / 'result.pptx').exists()
    assert not owner_alive(request['workspace'])
    image_calls = sum(call['kind'] == 'image' for call in state['calls'])
    assert image_calls >= 3
    state['fail'] = None
    previous = request['workspace']
    request = {**request, 'workspace': str(tmp_path / mode / 'resumed'), 'ancestors': [previous],
               'queue_deadline_at': time.time() + 30}
    events = []
    result = run(request, events)
    assert sum(call['kind'] == 'image' for call in state['calls']) == image_calls
    assert result['reused_nodes'] >= 3
    assert len(Presentation(result['path']).slides) == 3
    assert any(event['event'] == 'checkpoint' for event in events)


@pytest.mark.parametrize('change,extra_images', [('caption', 0), ('source', 1), ('corruption', 1)])
def test_resume_invalidates_only_affected_dependencies(tmp_path, provider_server, change, extra_images):
    url, state = provider_server
    request = payload(tmp_path / change, url, count=3)
    state['fail'] = {'kind': 'caption', 'phase': 'global', 'page': 2}
    with pytest.raises(WorkerFailed):
        run(request)
    images_before = sum(call['kind'] == 'image' for call in state['calls'])
    state['fail'] = None
    previous = request['workspace']
    if change == 'caption':
        request['config']['IMAGE_CAPTION_MODEL'] = 'fixture-caption-new'
    elif change == 'source':
        path = Path(request['pages'][0]['path'])
        with Image.open(path) as original:
            modified = original.copy()
        modified.putpixel((1, 1), (0, 0, 0))
        modified.save(path)
        request['pages'][0]['sha256'] = file_hash(path)
    else:
        record = json.loads(next((Path(previous) / 'nodes/candidate').glob('*.json')).read_text())
        Path(record['value']).write_bytes(b'corrupt image')
    request = {**request, 'workspace': str(tmp_path / change / 'resumed'), 'ancestors': [previous],
               'queue_deadline_at': time.time() + 30}
    result = run(request)
    assert sum(call['kind'] == 'image' for call in state['calls']) == images_before + extra_images
    assert result['pages'] == 3


@pytest.mark.parametrize('mode', ['simple', 'full'])
def test_partial_background_failure_keeps_source_without_overlay_and_warns(tmp_path, provider_server, mode):
    url, state = provider_server
    request = payload(tmp_path / mode, url, count=3, mode=mode)
    request['options']['allow_partial'] = True
    state['fail'] = {'kind': 'image', 'page': 2}
    result = run(request)
    failed_slide = Presentation(result['path']).slides[1]
    assert len(failed_slide.shapes) == 1
    assert not failed_slide.shapes[0].has_text_frame
    assert failed_slide.shapes[0].image.blob == Path(request['pages'][1]['path']).read_bytes()
    assert result['warnings']
    assert len(list((Path(request['workspace']) / 'nodes/analysis').glob('*.json'))) == 2 + (2 if mode == 'full' else 0)
