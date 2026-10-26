"""Real sockets: a 65s first page must survive a proxy's 60s read timeout.

Run explicitly; the slow upstream is synthetic and never consumes API credits.
"""
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from time import monotonic, sleep

import requests
from werkzeug.serving import make_server

from models import db, Page


def test_slow_description_survives_sixty_second_proxy(client, app, monkeypatch):
    from controllers import project_controller
    project_id = client.post('/api/projects', json={
        'creation_type': 'idea', 'idea_prompt': 'Synthetic slow proxy regression',
    }).json['data']['project_id']
    with app.app_context():
        page = Page(project_id=project_id, order_index=0, status='DRAFT')
        page.set_outline_content({'title': 'Slow page', 'points': []})
        db.session.add(page)
        db.session.commit()

    class Model:
        def flatten_outline(self, outline):
            return outline

        def generate_descriptions_stream(self, *_args, **_kwargs):
            sleep(65)
            yield {'page_index': 0, 'description_text': 'Generated after proxy deadline'}
            yield {'__stream_complete__': True}

    monkeypatch.setattr(project_controller, 'get_ai_service', lambda: Model())
    backend = make_server('127.0.0.1', 0, app, threaded=True)

    class Proxy(BaseHTTPRequestHandler):
        def do_POST(self):
            upstream = HTTPConnection('127.0.0.1', backend.server_port, timeout=60)
            try:
                body = self.rfile.read(int(self.headers['Content-Length']))
                upstream.request('POST', self.path, body, {'Content-Type': 'application/json'})
                response = upstream.getresponse()
                self.send_response(response.status)
                self.send_header('Content-Type', 'text/event-stream')
                self.end_headers()
                while chunk := response.read1(4096):
                    self.wfile.write(chunk)
                    self.wfile.flush()
            finally:
                upstream.close()

        def log_message(self, *_args):
            pass

    proxy = ThreadingHTTPServer(('127.0.0.1', 0), Proxy)
    threads = [Thread(target=s.serve_forever, daemon=True) for s in (backend, proxy)]
    for thread in threads:
        thread.start()
    started = monotonic()
    events = []
    try:
        with requests.post(f'http://127.0.0.1:{proxy.server_port}/api/projects/{project_id}/generate/descriptions/stream',
                           json={}, stream=True, timeout=(5, 60)) as response:
            assert response.status_code == 200
            assert monotonic() - started < 5
            for line in response.iter_lines(chunk_size=1):
                if line:
                    events.append(line)
        assert monotonic() - started >= 65
        assert sum(line == b': keep-alive' for line in events) >= 6
        assert b'event: description' in events and b'event: done' in events
        with app.app_context():
            page = Page.query.filter_by(project_id=project_id).one()
            assert page.status == 'DESCRIPTION_GENERATED'
            assert page.get_description_content()['text'] == 'Generated after proxy deadline'
    finally:
        for server in (proxy, backend):
            server.shutdown()
            server.server_close()
        for thread in threads:
            thread.join(3)
            assert not thread.is_alive()
