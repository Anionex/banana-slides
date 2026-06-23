"""Unit tests for analyze_template_task (Phase D).

Mocks ai_service.analyze_template at the boundary; verifies DB writes,
not_a_slide handling, and reanalyze status reset.
"""
import io
import uuid

import pytest
from PIL import Image


@pytest.fixture
def stub_submit_task(monkeypatch):
    calls = []

    def _record(task_id, func, *args, **kwargs):
        calls.append({'task_id': task_id, 'func': func.__name__,
                      'args': args, 'kwargs': kwargs})

    from services import task_manager as tm
    monkeypatch.setattr(tm.task_manager, 'submit_task', _record)
    return calls


def _png_bytes():
    img = Image.new('RGB', (32, 24), color=(0, 128, 255))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf


def _make_project(client) -> str:
    resp = client.post('/api/projects', json={
        'creation_type': 'idea', 'idea_prompt': 'analyze test',
    })
    return resp.get_json()['data']['project_id']


def _upload_asset(client, project_id):
    return client.post(
        f'/api/projects/{project_id}/template-assets',
        data={'image': (_png_bytes(), 'a.png')},
        content_type='multipart/form-data',
    ).get_json()['data']['asset']['id']


def _run_analyze_task(app, project_id, asset_id, ai_return):
    """Invoke analyze_template_task synchronously with a stub ai_service."""
    from services.task_manager import analyze_template_task
    from services.file_service import FileService
    from models import db, Task

    with app.app_context():
        task = Task(project_id=project_id, task_type='ANALYZE_TEMPLATE', status='PENDING')
        task.set_progress({'asset_id': asset_id, 'stage': 'queued'})
        db.session.add(task)
        db.session.commit()
        task_id = task.id

    class StubAI:
        def analyze_template(self, image_path, language='zh'):
            return ai_return

    file_service = FileService(app.config['UPLOAD_FOLDER'])
    analyze_template_task(task_id, project_id, asset_id, StubAI(), file_service, app)
    return task_id


def test_analyze_template_persists_nine_field_schema(client, stub_submit_task, app):
    from models import ProjectTemplateAsset, Task

    project_id = _make_project(client)
    asset_id = _upload_asset(client, project_id)

    fake_analysis = {
        'template_role': 'cover',
        'layout_structure': 'centered-title',
        'content_capacity': 'low',
        'text_regions': [{'name': 'title', 'position': 'center', 'size': 'large'}],
        'image_regions': [],
        'visual_density': 'low',
        'style_keywords': ['bold', 'modern'],
        'color_palette': ['#000000', '#FFFFFF'],
        'notes': 'cover with overlay',
    }
    task_id = _run_analyze_task(app, project_id, asset_id, fake_analysis)

    with app.app_context():
        asset = ProjectTemplateAsset.query.get(asset_id)
        assert asset.analysis_status == 'completed'
        assert asset.analysis_error is None
        assert asset.get_analysis()['template_role'] == 'cover'
        assert asset.analysis_notes == 'cover with overlay'

        task = Task.query.get(task_id)
        assert task.status == 'COMPLETED'


def test_analyze_template_handles_not_a_slide(client, stub_submit_task, app):
    from models import ProjectTemplateAsset

    project_id = _make_project(client)
    asset_id = _upload_asset(client, project_id)

    _run_analyze_task(app, project_id, asset_id, {'error': 'not_a_slide'})

    with app.app_context():
        asset = ProjectTemplateAsset.query.get(asset_id)
        assert asset.analysis_status == 'failed'
        assert asset.analysis_error == 'not_a_slide'
        assert asset.analysis_json is None


def test_reanalyze_resets_status_to_pending(client, stub_submit_task, app):
    from models import ProjectTemplateAsset, db

    project_id = _make_project(client)
    asset_id = _upload_asset(client, project_id)

    with app.app_context():
        asset = ProjectTemplateAsset.query.get(asset_id)
        asset.analysis_status = 'failed'
        asset.analysis_error = 'previous'
        db.session.commit()

    resp = client.post(
        f'/api/projects/{project_id}/template-assets/{asset_id}/reanalyze')
    assert resp.status_code == 202
    with app.app_context():
        asset = ProjectTemplateAsset.query.get(asset_id)
        assert asset.analysis_status == 'pending'
        assert asset.analysis_error is None
