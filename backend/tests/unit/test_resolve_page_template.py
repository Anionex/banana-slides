"""Unit tests for resolve_page_template priority chain (Phase E, PRD §13)."""
import io
import uuid

import pytest
from PIL import Image


@pytest.fixture
def stub_submit_task(monkeypatch):
    calls = []

    def _record(task_id, func, *args, **kwargs):
        calls.append({'task_id': task_id, 'func': func.__name__})

    from services import task_manager as tm
    monkeypatch.setattr(tm.task_manager, 'submit_task', _record)
    return calls


def _png_bytes():
    img = Image.new('RGB', (32, 24), color=(180, 60, 200))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf


def _make_project(client) -> str:
    return client.post('/api/projects', json={
        'creation_type': 'idea', 'idea_prompt': 'resolve test',
    }).get_json()['data']['project_id']


def _upload_asset(client, project_id):
    return client.post(
        f'/api/projects/{project_id}/template-assets',
        data={'image': (_png_bytes(), 'a.png')},
        content_type='multipart/form-data',
    ).get_json()['data']['asset']['id']


def test_resolve_priority_1_page_asset_wins(client, stub_submit_task, app):
    """page.template_asset_id beats project.template_image_path."""
    from services.task_manager import resolve_page_template
    from services.file_service import FileService
    from models import db, Project, Page, ProjectTemplateAsset

    project_id = _make_project(client)
    asset_id = _upload_asset(client, project_id)

    with app.app_context():
        proj = Project.query.get(project_id)
        proj.template_image_path = 'projects/legacy/template.png'  # legacy fallback
        proj.template_style = 'legacy style'
        page = Page(id=str(uuid.uuid4()), project_id=project_id, order_index=0,
                    template_asset_id=asset_id, template_style_text='page style')
        db.session.add(page)
        db.session.commit()
        page = Page.query.get(page.id)
        proj = Project.query.get(project_id)

        fs = FileService(app.config['UPLOAD_FOLDER'])
        image_path, style_text = resolve_page_template(page, proj, fs)

        asset = ProjectTemplateAsset.query.get(asset_id)
        assert image_path is not None
        assert image_path.endswith(asset.image_path.split('/')[-1])
        assert style_text == 'page style'  # page wins over project


def test_resolve_priority_2_page_style_only_when_no_asset(
        client, stub_submit_task, app):
    """Style-only page: image_path None, style_text from page."""
    from services.task_manager import resolve_page_template
    from services.file_service import FileService
    from models import db, Project, Page

    project_id = _make_project(client)

    with app.app_context():
        proj = Project.query.get(project_id)
        page = Page(id=str(uuid.uuid4()), project_id=project_id, order_index=0,
                    template_asset_id=None, template_style_text='just words')
        db.session.add(page)
        db.session.commit()
        page = Page.query.get(page.id)
        proj = Project.query.get(project_id)

        fs = FileService(app.config['UPLOAD_FOLDER'])
        image_path, style_text = resolve_page_template(page, proj, fs)

        assert image_path is None
        assert style_text == 'just words'


def test_resolve_priority_3_project_image_fallback(client, stub_submit_task, app):
    """Page has nothing, project.template_image_path used."""
    import os
    from services.task_manager import resolve_page_template
    from services.file_service import FileService
    from models import db, Project, Page

    project_id = _make_project(client)

    with app.app_context():
        proj = Project.query.get(project_id)
        # Place a real file at the legacy path so get_template_path resolves it
        legacy_rel = f'projects/{project_id}/template.png'
        legacy_abs = os.path.join(app.config['UPLOAD_FOLDER'], legacy_rel)
        os.makedirs(os.path.dirname(legacy_abs), exist_ok=True)
        with open(legacy_abs, 'wb') as f:
            f.write(_png_bytes().getvalue())
        proj.template_image_path = legacy_rel
        proj.template_style = 'legacy style'
        page = Page(id=str(uuid.uuid4()), project_id=project_id, order_index=0)
        db.session.add(page)
        db.session.commit()
        page = Page.query.get(page.id)
        proj = Project.query.get(project_id)

        fs = FileService(app.config['UPLOAD_FOLDER'])
        image_path, style_text = resolve_page_template(page, proj, fs)

        assert image_path is not None  # built from project legacy path
        assert style_text == 'legacy style'


def test_resolve_no_template_at_all(client, stub_submit_task, app):
    """Both page and project empty → (None, None)."""
    from services.task_manager import resolve_page_template
    from services.file_service import FileService
    from models import db, Project, Page

    project_id = _make_project(client)

    with app.app_context():
        page = Page(id=str(uuid.uuid4()), project_id=project_id, order_index=0)
        db.session.add(page)
        db.session.commit()
        page = Page.query.get(page.id)
        proj = Project.query.get(project_id)

        fs = FileService(app.config['UPLOAD_FOLDER'])
        image_path, style_text = resolve_page_template(page, proj, fs)

        assert image_path is None
        assert style_text is None


def test_image_prompt_includes_page_style_block(client, stub_submit_task, app):
    """generate_image_prompt threads page_style_text into the prompt body."""
    from services.ai_service import AIService

    class FakeAI(AIService):
        def __init__(self):
            pass

        def generate_outline_text(self, outline):
            return 'fake outline'

        def remove_markdown_images(self, t):
            return t

    svc = FakeAI()
    prompt_with = svc.generate_image_prompt(
        outline=[], page={'title': 'p1'}, page_desc='hello world',
        page_index=2, has_template=True, page_style_text='retro 80s neon')
    assert 'retro 80s neon' in prompt_with
    assert '<page_style>' in prompt_with

    prompt_without = svc.generate_image_prompt(
        outline=[], page={'title': 'p1'}, page_desc='hello world',
        page_index=2, has_template=True)
    assert '<page_style>' not in prompt_without
