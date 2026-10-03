"""Regression for the public site's 60s proxy timeout and orphaned page flags."""
from threading import Event
from time import monotonic, sleep

import pytest

from models import db, Project, Page
from utils.sse import with_heartbeat


def seed(client, app):
    project_id = client.post('/api/projects', json={
        'creation_type': 'idea', 'idea_prompt': 'Description regression',
    }).json['data']['project_id']
    with app.app_context():
        for i in range(3):
            page = Page(project_id=project_id, order_index=i, status='DRAFT')
            page.set_outline_content({'title': str(i), 'points': []})
            if i == 2:
                page.set_description_content({'text': 'Existing description'})
                page.status = 'DESCRIPTION_GENERATED'
            db.session.add(page)
        db.session.commit()
    return project_id


def statuses(app, project_id):
    with app.app_context():
        pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()
        return db.session.get(Project, project_id).status, [
            (p.status, p.get_description_content()) for p in pages
        ]


def wait_recovered(app, project_id):
    deadline = monotonic() + 3
    while monotonic() < deadline:
        state, pages = statuses(app, project_id)
        if state != 'GENERATING_DESCRIPTIONS' and all(p[0] != 'GENERATING_DESCRIPTION' for p in pages):
            return state, pages
        sleep(0.01)
    pytest.fail('Description flags were not recovered')


@pytest.mark.parametrize('outcome', ['success', 'error', 'disconnect', 'timeout', 'partial'])
def test_description_stream_lifecycle(client, app, monkeypatch, outcome):
    from controllers import project_controller
    project_id = seed(client, app)
    entered, release, closed = Event(), Event(), Event()

    class SlowModel:
        def flatten_outline(self, outline):
            return outline

        def generate_descriptions_stream(self, *_args, **_kwargs):
            try:
                # The slow provider must not retain a database transaction.
                assert not db.session.registry.has()
                entered.set()
                assert release.wait(3)
                if outcome == 'error':
                    raise RuntimeError('Synthetic upstream failure')
                for i in range(1 if outcome == 'partial' else 3):
                    yield {'page_index': i, 'description_text': 'Generated ' + str(i)}
                yield {'__stream_complete__': True}
            finally:
                closed.set()

    monkeypatch.setattr(project_controller, 'get_ai_service', lambda: SlowModel())
    monkeypatch.setattr(project_controller, 'with_heartbeat', lambda source, **kwargs:
                        with_heartbeat(source, interval=0.02,
                                       idle_timeout=0.15 if outcome == 'timeout' else 2, **kwargs))
    response = client.post(f'/api/projects/{project_id}/generate/descriptions/stream', json={})
    iterator = iter(response.response)
    try:
        assert next(iterator) == b': keep-alive\n\n'
        assert entered.wait(1)
        assert next(iterator) == b': keep-alive\n\n'
        if outcome == 'disconnect':
            response.close()
        elif outcome == 'timeout':
            body = b''.join(iterator).decode()
            assert 'event: error' in body and '页面描述' in body
        release.set()
        if outcome not in ('disconnect', 'timeout'):
            body = b''.join(iterator).decode()
            assert ('event: error' if outcome == 'error' else 'event: done') in body
        assert closed.wait(1)
        state, pages = wait_recovered(app, project_id)
        assert state == 'DESCRIPTIONS_GENERATED'
        if outcome in ('error', 'disconnect', 'timeout'):
            assert pages == [('DRAFT', None), ('DRAFT', None),
                             ('DESCRIPTION_GENERATED', {'text': 'Existing description'})]
        elif outcome == 'partial':
            assert pages[0][1]['text'] == 'Generated 0'
            assert pages[1] == ('DRAFT', None)
            assert pages[2][1]['text'] == 'Existing description'
        else:
            assert [p[1]['text'] for p in pages] == ['Generated 0', 'Generated 1', 'Generated 2']
    finally:
        release.set()
        response.close()
        closed.wait(3)


def test_disconnect_after_saved_page_keeps_partial_result(client, app, monkeypatch):
    from controllers import project_controller
    project_id = seed(client, app)
    release, waiting = Event(), Event()

    class Model:
        def flatten_outline(self, outline):
            return outline

        def generate_descriptions_stream(self, *_args, **_kwargs):
            yield {'page_index': 0, 'description_text': 'Saved before disconnect'}
            waiting.set()
            release.wait(3)
            yield {'page_index': 1, 'description_text': 'Must not be saved'}

    monkeypatch.setattr(project_controller, 'get_ai_service', lambda: Model())
    response = client.post(f'/api/projects/{project_id}/generate/descriptions/stream', json={})
    iterator = iter(response.response)
    try:
        assert next(iterator).startswith(b': keep-alive')
        assert b'event: description' in next(iterator)
        assert waiting.wait(1)
        response.close()
        release.set()
        _, pages = wait_recovered(app, project_id)
        assert pages[0][1]['text'] == 'Saved before disconnect'
        assert pages[1] == ('DRAFT', None)
        assert pages[2][1]['text'] == 'Existing description'
    finally:
        release.set()
        response.close()


def test_old_stream_cleanup_does_not_reset_a_new_attempt(client, app, monkeypatch):
    from datetime import datetime, timedelta
    from controllers import project_controller
    project_id = seed(client, app)
    entered, release, cleaned = Event(), Event(), Event()

    class Model:
        def flatten_outline(self, outline):
            return outline

        def generate_descriptions_stream(self, *_args, **_kwargs):
            entered.set()
            release.wait(3)
            yield {'page_index': 0, 'description_text': 'Late old result'}

    def observe_cleanup(source, **kwargs):
        def wrapped(stop):
            try:
                yield from source(stop)
            finally:
                cleaned.set()
        return with_heartbeat(wrapped, **kwargs)

    monkeypatch.setattr(project_controller, 'get_ai_service', lambda: Model())
    monkeypatch.setattr(project_controller, 'with_heartbeat', observe_cleanup)
    response = client.post(f'/api/projects/{project_id}/generate/descriptions/stream', json={})
    try:
        assert entered.wait(1)
        # Another request now owns the page markers; an old disconnect cannot clear them.
        with app.app_context():
            for page in Page.query.filter_by(project_id=project_id):
                page.updated_at = datetime.utcnow() + timedelta(seconds=1)
            db.session.commit()
        response.close()
        release.set()
        assert cleaned.wait(1)
        state, pages = statuses(app, project_id)
        assert state == 'GENERATING_DESCRIPTIONS'
        assert all(p[0] == 'GENERATING_DESCRIPTION' for p in pages)
        assert pages[0][1] is None
    finally:
        release.set()
        response.close()
        cleaned.wait(3)
