"""Integration tests for the per-page template Asset CRUD endpoints.

The async tasks (analyze / auto-match / split) are stubbed at the
`task_manager.submit_task` boundary so tests can assert immediate API
behaviour without waiting on the ThreadPoolExecutor.
"""
import io
import json
import uuid

import pytest
from PIL import Image


@pytest.fixture
def stub_submit_task(monkeypatch):
    """Replace task_manager.submit_task with a recorder no-op."""
    calls = []

    def _record(task_id, func, *args, **kwargs):
        calls.append({'task_id': task_id, 'func': func.__name__,
                      'args': args, 'kwargs': kwargs})

    from services import task_manager as tm
    monkeypatch.setattr(tm.task_manager, 'submit_task', _record)
    return calls


def _png_bytes(color=(0, 128, 255)):
    img = Image.new('RGB', (40, 30), color=color)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf


def _make_project(client) -> str:
    resp = client.post('/api/projects', json={
        'creation_type': 'idea',
        'idea_prompt': 'asset CRUD test',
    })
    assert resp.status_code in (200, 201)
    return resp.get_json()['data']['project_id']


def _make_page(client, project_id: str, order_index: int = 0) -> str:
    """Insert a page directly via the ORM (creating projects via API only seeds 1)."""
    from models import db, Page
    page = Page(id=str(uuid.uuid4()), project_id=project_id, order_index=order_index)
    db.session.add(page)
    db.session.commit()
    return page.id


def test_upload_template_asset_creates_record_and_enqueues_analyze(
        client, stub_submit_task):
    project_id = _make_project(client)

    resp = client.post(
        f'/api/projects/{project_id}/template-assets',
        data={'image': (_png_bytes(), 'cover.png'), 'user_label': '封面'},
        content_type='multipart/form-data',
    )
    assert resp.status_code == 201
    payload = resp.get_json()['data']
    assert payload['asset']['user_label'] == '封面'
    assert payload['asset']['source'] == 'upload'
    assert payload['asset']['analysis_status'] == 'pending'
    assert payload['analyze_task_id']

    assert any(c['func'] == 'analyze_template_task' for c in stub_submit_task)


def test_upload_with_bind_to_page_links_page(client, stub_submit_task):
    project_id = _make_project(client)
    page_id = _make_page(client, project_id)

    resp = client.post(
        f'/api/projects/{project_id}/template-assets?bind_to_page={page_id}',
        data={'image': (_png_bytes(), 'a.png')},
        content_type='multipart/form-data',
    )
    assert resp.status_code == 201
    asset_id = resp.get_json()['data']['asset']['id']

    from models import Page
    page = Page.query.get(page_id)
    assert page.template_asset_id == asset_id
    assert page.template_selection_source == 'manual'


def test_upload_with_bad_bind_to_page_returns_400(client, stub_submit_task):
    project_id = _make_project(client)
    resp = client.post(
        f'/api/projects/{project_id}/template-assets?bind_to_page=does-not-exist',
        data={'image': (_png_bytes(), 'a.png')},
        content_type='multipart/form-data',
    )
    assert resp.status_code == 400


def test_list_template_assets_orders_by_sort_order(client, stub_submit_task):
    project_id = _make_project(client)
    for i in range(3):
        client.post(
            f'/api/projects/{project_id}/template-assets',
            data={'image': (_png_bytes(color=(10 * i, 0, 0)), f'a{i}.png')},
            content_type='multipart/form-data',
        )

    resp = client.get(f'/api/projects/{project_id}/template-assets')
    assert resp.status_code == 200
    assets = resp.get_json()['data']['assets']
    assert len(assets) == 3
    sort_orders = [a['sort_order'] for a in assets]
    assert sort_orders == sorted(sort_orders)


def test_patch_template_asset_updates_label_and_marks_user_edited(
        client, stub_submit_task):
    project_id = _make_project(client)
    asset_id = client.post(
        f'/api/projects/{project_id}/template-assets',
        data={'image': (_png_bytes(), 'a.png')},
        content_type='multipart/form-data',
    ).get_json()['data']['asset']['id']

    resp = client.patch(
        f'/api/projects/{project_id}/template-assets/{asset_id}',
        json={'user_label': '对比页', 'analysis_json': {'summary': 'hi'},
              'analysis_notes': 'manually adjusted'},
    )
    assert resp.status_code == 200
    asset = resp.get_json()['data']['asset']
    assert asset['user_label'] == '对比页'
    assert asset['analysis_json'] == {'summary': 'hi'}
    assert asset['analysis_notes'] == 'manually adjusted'

    from models import ProjectTemplateAsset
    refreshed = ProjectTemplateAsset.query.get(asset_id)
    assert refreshed.user_edited_analysis is True


def test_patch_template_asset_rejects_status(client, stub_submit_task):
    project_id = _make_project(client)
    asset_id = client.post(
        f'/api/projects/{project_id}/template-assets',
        data={'image': (_png_bytes(), 'a.png')},
        content_type='multipart/form-data',
    ).get_json()['data']['asset']['id']

    resp = client.patch(
        f'/api/projects/{project_id}/template-assets/{asset_id}',
        json={'analysis_status': 'completed'},
    )
    assert resp.status_code == 400


def test_delete_asset_clears_referenced_pages(client, stub_submit_task):
    from models import db, Page

    project_id = _make_project(client)
    page1 = _make_page(client, project_id, order_index=0)
    page2 = _make_page(client, project_id, order_index=1)

    asset_id = client.post(
        f'/api/projects/{project_id}/template-assets',
        data={'image': (_png_bytes(), 'a.png')},
        content_type='multipart/form-data',
    ).get_json()['data']['asset']['id']

    Page.query.filter(Page.id.in_([page1, page2])).update(
        {Page.template_asset_id: asset_id,
         Page.template_selection_source: 'manual'},
        synchronize_session=False,
    )
    db.session.commit()

    db.session.execute(db.text('PRAGMA foreign_keys = ON'))

    resp = client.delete(f'/api/projects/{project_id}/template-assets/{asset_id}')
    assert resp.status_code == 200
    body = resp.get_json()['data']
    assert body['deleted'] is True
    assert set(body['cleared_page_ids']) == {page1, page2}

    refreshed = {p.id: p for p in Page.query.filter(
        Page.id.in_([page1, page2])).all()}
    for p in refreshed.values():
        assert p.template_asset_id is None
        assert p.template_selection_source is None


def test_reanalyze_resets_status(client, stub_submit_task):
    from models import ProjectTemplateAsset, db
    project_id = _make_project(client)
    asset_id = client.post(
        f'/api/projects/{project_id}/template-assets',
        data={'image': (_png_bytes(), 'a.png')},
        content_type='multipart/form-data',
    ).get_json()['data']['asset']['id']

    asset = ProjectTemplateAsset.query.get(asset_id)
    asset.analysis_status = 'failed'
    asset.analysis_error = 'previous failure'
    db.session.commit()

    resp = client.post(f'/api/projects/{project_id}/template-assets/{asset_id}/reanalyze')
    assert resp.status_code == 202

    refreshed = ProjectTemplateAsset.query.get(asset_id)
    assert refreshed.analysis_status == 'pending'
    assert refreshed.analysis_error is None
