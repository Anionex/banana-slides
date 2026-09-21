from threading import Event
from time import monotonic

from utils.sse import with_heartbeat


def test_initial_and_periodic_heartbeat_before_first_page():
    release, closed = Event(), Event()
    def source(stop):
        try:
            release.wait(2)
            yield 'event: page\ndata: {}\n\n'
            yield 'event: done\ndata: {}\n\n'
        finally:
            closed.set()
    stream = with_heartbeat(source, interval=0.02, idle_timeout=1)
    start = monotonic()
    assert next(stream) == ': keep-alive\n\n'
    assert next(stream) == ': keep-alive\n\n'
    assert monotonic() - start < 0.5
    release.set()
    assert list(stream) == ['event: page\ndata: {}\n\n', 'event: done\ndata: {}\n\n']
    assert closed.wait(1)


def test_timeout_stops_producer_and_sends_terminal_error():
    release, closed = Event(), Event()
    late_writes = []
    def source(stop):
        try:
            release.wait(2)
            if stop.is_set():
                return
            late_writes.append('unexpected write')
            yield 'event: done\ndata: {}\n\n'
        finally:
            closed.set()
    events = list(with_heartbeat(source, interval=0.01, idle_timeout=0.04))
    assert 'event: error' in events[-1]
    release.set()
    assert closed.wait(1)
    assert late_writes == []


def test_disconnected_client_releases_producer_without_late_work():
    release, closed = Event(), Event()
    def source(stop):
        try:
            release.wait(2)
            assert stop.is_set()
            yield 'ignored'
        finally:
            closed.set()
    stream = with_heartbeat(source, interval=0.01)
    next(stream)
    stream.close()
    release.set()
    assert closed.wait(1)


def test_worker_keeps_private_visitor_context(app, monkeypatch):
    from flask import current_app, has_request_context
    from services.public_demo import visitor_scope, visitor
    monkeypatch.setitem(app.config, 'PUBLIC_DEMO', True)
    snapshot = {'token': 'isolated-visitor', 'config': {
        'partner': 'inferera', 'provider_keys': {'inferera': 'visitor-test-key'},
    }}
    def source(stop):
        with app.app_context():
            assert current_app._get_current_object() is app
            assert not has_request_context()
            assert visitor() == snapshot
            assert current_app.config['TEXT_API_KEY'] == 'visitor-test-key'
            yield 'done'
    with app.app_context(), visitor_scope(snapshot):
        assert list(with_heartbeat(source))[-1] == 'done'
    assert visitor() is None


def test_route_timeout_does_not_save_late_pages(client, app, monkeypatch):
    from controllers import project_controller
    from models import db, Project
    release, closed = Event(), Event()

    class SlowModel:
        def generate_outline_stream(self, *_args, **_kwargs):
            try:
                release.wait(2)
                yield {'title': 'Must not be saved', 'points': []}
            finally:
                closed.set()

    monkeypatch.setattr(project_controller, 'get_ai_service', lambda: SlowModel())
    monkeypatch.setattr(project_controller, 'with_heartbeat',
                        lambda source: with_heartbeat(source, interval=0.01, idle_timeout=0.04))
    project_id = client.post('/api/projects', json={
        'creation_type': 'idea', 'idea_prompt': 'Timeout regression',
    }).json['data']['project_id']
    response = client.post(f'/api/projects/{project_id}/generate/outline/stream', json={})
    assert 'event: error' in response.get_data(as_text=True)
    release.set()
    assert closed.wait(1)
    with app.app_context():
        project = db.session.get(Project, project_id)
        assert project.status == 'DRAFT'
        assert len(project.pages) == 0
