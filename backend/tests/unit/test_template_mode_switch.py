"""Integration tests for template-mode switch + page template patch."""
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


def _png_bytes(color=(255, 0, 0)):
    img = Image.new('RGB', (32, 24), color=color)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf


def _make_project(client) -> str:
    resp = client.post('/api/projects', json={
        'creation_type': 'idea',
        'idea_prompt': 'mode switch test',
    })
    return resp.get_json()['data']['project_id']


def _make_pages(client, project_id: str, n: int = 3):
    from models import db, Page
    ids = []
    for i in range(n):
        page = Page(id=str(uuid.uuid4()), project_id=project_id, order_index=i)
        db.session.add(page)
        ids.append(page.id)
    db.session.commit()
    return ids


def _upload_asset(client, project_id):
    return client.post(
        f'/api/projects/{project_id}/template-assets',
        data={'image': (_png_bytes(), 'a.png')},
        content_type='multipart/form-data',
    ).get_json()['data']['asset']['id']


def test_default_template_mode_is_single(client, stub_submit_task):
    project_id = _make_project(client)
    resp = client.get(f'/api/projects/{project_id}')
    assert resp.status_code == 200
    assert resp.get_json()['data'].get('template_mode') == 'single'


def test_switch_single_to_multi_does_not_touch_pages(client, stub_submit_task):
    from models import Project, Page

    project_id = _make_project(client)
    asset_id = _upload_asset(client, project_id)
    page_ids = _make_pages(client, project_id, n=2)
    # Pre-bind both pages to the asset (single-mode UI hint)
    for pid in page_ids:
        client.patch(
            f'/api/projects/{project_id}/pages/{pid}/template',
            json={'template_asset_id': asset_id, 'template_style_text': 'tone',
                  'selection_source': 'manual'},
        )

    resp = client.patch(
        f'/api/projects/{project_id}/template-mode', json={'mode': 'multi'}
    )
    assert resp.status_code == 200
    assert Project.query.get(project_id).template_mode == 'multi'
    for p in Page.query.filter(Page.id.in_(page_ids)).all():
        assert p.template_asset_id == asset_id
        assert p.template_style_text == 'tone'


def test_switch_multi_to_single_with_existing_asset_overwrites_pages(
        client, stub_submit_task):
    from models import Project, Page
    project_id = _make_project(client)
    a1 = _upload_asset(client, project_id)
    a2 = _upload_asset(client, project_id)
    page_ids = _make_pages(client, project_id, n=3)
    # Set per-page templates differently
    client.patch(f'/api/projects/{project_id}/template-mode', json={'mode': 'multi'})
    for i, pid in enumerate(page_ids):
        client.patch(
            f'/api/projects/{project_id}/pages/{pid}/template',
            json={'template_asset_id': a1 if i == 0 else a2,
                  'template_style_text': f'style-{i}',
                  'selection_source': 'manual'},
        )

    resp = client.patch(
        f'/api/projects/{project_id}/template-mode',
        json={'mode': 'single', 'unified_asset_id': a1,
              'unified_style_text': 'unified tone'},
    )
    assert resp.status_code == 200
    proj = Project.query.get(project_id)
    assert proj.template_mode == 'single'
    pages = Page.query.filter(Page.id.in_(page_ids)).all()
    for p in pages:
        assert p.template_asset_id == a1
        assert p.template_style_text == 'unified tone'
        assert p.template_selection_source == 'batch_apply'


def test_switch_multi_to_single_requires_unifier(client, stub_submit_task):
    project_id = _make_project(client)
    resp = client.patch(
        f'/api/projects/{project_id}/template-mode',
        json={'mode': 'single'},
    )
    assert resp.status_code == 400


def test_switch_multi_to_single_rejects_foreign_asset(client, stub_submit_task):
    project_id = _make_project(client)
    other_project = _make_project(client)
    foreign_asset = _upload_asset(client, other_project)
    resp = client.patch(
        f'/api/projects/{project_id}/template-mode',
        json={'mode': 'single', 'unified_asset_id': foreign_asset},
    )
    assert resp.status_code == 400


def test_switch_with_upload_creates_asset_and_overwrites_pages(client, stub_submit_task):
    from models import Project, Page, ProjectTemplateAsset
    project_id = _make_project(client)
    page_ids = _make_pages(client, project_id, n=2)
    client.patch(f'/api/projects/{project_id}/template-mode', json={'mode': 'multi'})

    resp = client.post(
        f'/api/projects/{project_id}/template-mode/single-with-upload',
        data={'image': (_png_bytes(), 'unified.png'),
              'unified_style_text': 'consistent vibe'},
        content_type='multipart/form-data',
    )
    assert resp.status_code == 201
    body = resp.get_json()['data']
    new_asset_id = body['asset']['id']

    proj = Project.query.get(project_id)
    assert proj.template_mode == 'single'
    asset = ProjectTemplateAsset.query.get(new_asset_id)
    assert asset.project_id == project_id
    for p in Page.query.filter(Page.id.in_(page_ids)).all():
        assert p.template_asset_id == new_asset_id
        assert p.template_style_text == 'consistent vibe'


def test_patch_page_template_validates_project_membership(client, stub_submit_task):
    """page must belong to project, asset must belong to project."""
    p1 = _make_project(client)
    p2 = _make_project(client)
    page_p2 = _make_pages(client, p2, n=1)[0]

    # Page in p2 referenced via p1's URL — must 404
    resp = client.patch(
        f'/api/projects/{p1}/pages/{page_p2}/template',
        json={'template_asset_id': None, 'selection_source': 'manual'},
    )
    assert resp.status_code == 404

    # Asset from foreign project — must 400
    page_p1 = _make_pages(client, p1, n=1)[0]
    foreign_asset = _upload_asset(client, p2)
    resp = client.patch(
        f'/api/projects/{p1}/pages/{page_p1}/template',
        json={'template_asset_id': foreign_asset, 'selection_source': 'manual'},
    )
    assert resp.status_code == 400


def test_patch_page_template_clears_match_metadata_on_manual(client, stub_submit_task):
    from models import db, Page
    project_id = _make_project(client)
    asset_id = _upload_asset(client, project_id)
    page_id = _make_pages(client, project_id, n=1)[0]

    page = Page.query.get(page_id)
    page.template_asset_id = asset_id
    page.template_match_reason = 'auto reasoning'
    page.template_match_confidence = 0.92
    page.template_selection_source = 'auto'
    db.session.commit()

    resp = client.patch(
        f'/api/projects/{project_id}/pages/{page_id}/template',
        json={'template_asset_id': asset_id, 'selection_source': 'manual'},
    )
    assert resp.status_code == 200
    page = Page.query.get(page_id)
    assert page.template_match_reason is None
    assert page.template_match_confidence is None
    assert page.template_selection_source == 'manual'


def test_auto_match_requires_descriptions(client, stub_submit_task):
    project_id = _make_project(client)
    _make_pages(client, project_id, n=2)
    _upload_asset(client, project_id)

    resp = client.post(
        f'/api/projects/{project_id}/template-assets/auto-match',
        json={'overwrite_existing': True, 'preserve_non_empty': False},
    )
    assert resp.status_code == 400
    err = resp.get_json()['error']
    assert err['code'] == 'MISSING_DESCRIPTIONS'
    assert 'missing_page_ids' in err
    assert len(err['missing_page_ids']) == 2


def test_auto_match_single_page_requires_completed_asset(client, stub_submit_task):
    from models import db, Page
    project_id = _make_project(client)
    page_id = _make_pages(client, project_id, n=1)[0]
    page = Page.query.get(page_id)
    page.set_description_content({'title': 'x', 'text_content': ['hi']})
    db.session.commit()
    _upload_asset(client, project_id)  # status pending

    resp = client.post(
        f'/api/projects/{project_id}/pages/{page_id}/template/auto-match'
    )
    assert resp.status_code == 400
    assert resp.get_json()['error']['code'] == 'NO_ANALYZED_TEMPLATES'
