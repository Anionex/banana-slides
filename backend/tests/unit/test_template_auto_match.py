"""Unit tests for auto_match_templates_task and threshold batching (Phase D)."""
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
    img = Image.new('RGB', (32, 24), color=(20, 80, 150))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf


def _make_project(client) -> str:
    return client.post('/api/projects', json={
        'creation_type': 'idea', 'idea_prompt': 'auto-match test',
    }).get_json()['data']['project_id']


def _upload_asset(client, project_id):
    return client.post(
        f'/api/projects/{project_id}/template-assets',
        data={'image': (_png_bytes(), 'a.png')},
        content_type='multipart/form-data',
    ).get_json()['data']['asset']['id']


def _make_pages_with_descriptions(app, project_id, n=3):
    from models import db, Page
    ids = []
    with app.app_context():
        for i in range(n):
            page = Page(id=str(uuid.uuid4()), project_id=project_id, order_index=i)
            page.set_description_content({
                'title': f'Page {i+1}',
                'text_content': [f'Content for page {i+1}'],
            })
            db.session.add(page)
            ids.append(page.id)
        db.session.commit()
    return ids


def _mark_assets_completed(app, project_id):
    from models import db, ProjectTemplateAsset
    with app.app_context():
        for a in ProjectTemplateAsset.query.filter_by(project_id=project_id).all():
            a.analysis_status = 'completed'
            a.set_analysis({
                'template_role': 'content',
                'layout_structure': 'title-top-two-column',
                'content_capacity': 'medium',
                'visual_density': 'medium',
                'style_keywords': ['clean'],
                'notes': 'auto-match-test',
            })
        db.session.commit()


def _run_auto_match(app, project_id, llm_return, page_id=None,
                    overwrite_existing=True, preserve_non_empty=False):
    from services.task_manager import auto_match_templates_task
    from models import db, Task

    with app.app_context():
        task = Task(project_id=project_id, task_type='AUTO_MATCH_TEMPLATES',
                    status='PENDING')
        db.session.add(task)
        db.session.commit()
        task_id = task.id

    class StubAI:
        calls = []

        def auto_match_templates(self, project_id, language='zh',
                                 overwrite_existing=True,
                                 preserve_non_empty=False):
            self.calls.append({'project_id': project_id})
            return llm_return

        def generate_json(self, prompt):
            self.calls.append({'prompt': prompt[:50]})
            return llm_return

        def _trim_template_for_match(self, asset):
            return {'asset_id': asset.id, 'user_label': asset.user_label or ''}

        def _trim_page_for_match(self, page, desc):
            return {'page_id': page.id, 'order_index': page.order_index,
                    'title': desc.get('title', ''), 'summary': '',
                    'content_density': 'low'}

    auto_match_templates_task(task_id, project_id, page_id,
                              overwrite_existing, preserve_non_empty,
                              StubAI(), app)
    return task_id


def test_auto_match_writes_template_asset_to_pages(client, stub_submit_task, app):
    from models import Page

    project_id = _make_project(client)
    asset_id = _upload_asset(client, project_id)
    _mark_assets_completed(app, project_id)
    page_ids = _make_pages_with_descriptions(app, project_id, n=2)

    llm_return = [
        {'page_id': page_ids[0], 'template_asset_id': asset_id,
         'status': 'matched', 'confidence': 0.85, 'reason': 'fits'},
        {'page_id': page_ids[1], 'template_asset_id': asset_id,
         'status': 'matched', 'confidence': 0.75, 'reason': 'also fits'},
    ]
    _run_auto_match(app, project_id, llm_return)

    with app.app_context():
        for pid in page_ids:
            page = Page.query.get(pid)
            assert page.template_asset_id == asset_id
            assert page.template_selection_source == 'auto'
            assert page.template_match_confidence is not None


def test_auto_match_undecided_nulls_template_when_overwrite(client, stub_submit_task, app):
    from models import Page

    project_id = _make_project(client)
    asset_id = _upload_asset(client, project_id)
    _mark_assets_completed(app, project_id)
    page_ids = _make_pages_with_descriptions(app, project_id, n=1)

    llm_return = [{'page_id': page_ids[0], 'template_asset_id': None,
                   'status': 'undecided', 'confidence': 0.2,
                   'reason': 'unsure'}]
    _run_auto_match(app, project_id, llm_return, overwrite_existing=True)

    with app.app_context():
        page = Page.query.get(page_ids[0])
        assert page.template_asset_id is None
        assert page.template_match_reason == 'unsure'


def test_auto_match_preserve_non_empty_skips_already_assigned(
        client, stub_submit_task, app):
    from models import db, Page

    project_id = _make_project(client)
    a1 = _upload_asset(client, project_id)
    a2 = _upload_asset(client, project_id)
    _mark_assets_completed(app, project_id)
    page_ids = _make_pages_with_descriptions(app, project_id, n=2)

    with app.app_context():
        page = Page.query.get(page_ids[0])
        page.template_asset_id = a1
        page.template_selection_source = 'manual'
        db.session.commit()

    llm_return = [
        {'page_id': page_ids[0], 'template_asset_id': a2,
         'status': 'matched', 'confidence': 0.9, 'reason': 'better'},
        {'page_id': page_ids[1], 'template_asset_id': a2,
         'status': 'matched', 'confidence': 0.8, 'reason': 'fits'},
    ]
    _run_auto_match(app, project_id, llm_return, preserve_non_empty=True)

    with app.app_context():
        # page 0 untouched, still on a1 with manual source
        p0 = Page.query.get(page_ids[0])
        assert p0.template_asset_id == a1
        assert p0.template_selection_source == 'manual'
        # page 1 picked up auto match
        p1 = Page.query.get(page_ids[1])
        assert p1.template_asset_id == a2


def test_auto_match_rejects_foreign_asset_id_from_llm(client, stub_submit_task, app):
    from models import Page

    project_id = _make_project(client)
    asset_id = _upload_asset(client, project_id)
    _mark_assets_completed(app, project_id)
    page_ids = _make_pages_with_descriptions(app, project_id, n=1)

    llm_return = [{'page_id': page_ids[0],
                   'template_asset_id': 'fabricated-id-from-llm',
                   'status': 'matched', 'confidence': 0.9,
                   'reason': 'hallucinated'}]
    _run_auto_match(app, project_id, llm_return)

    with app.app_context():
        page = Page.query.get(page_ids[0])
        assert page.template_asset_id is None  # rejected → undecided
        assert page.template_selection_source is None


def test_auto_match_threshold_triggers_batching(app):
    """Decision 5: pages>50 OR templates>20 → 30-page batches."""
    from services.ai_service import AIService
    from models import db, Project, Page, ProjectTemplateAsset

    with app.app_context():
        proj = Project(creation_type='idea', idea_prompt='batch test',
                       status='DRAFT')
        db.session.add(proj)
        db.session.commit()
        proj_id = proj.id

        for i in range(2):
            a = ProjectTemplateAsset(
                project_id=proj_id, image_path=f'p/{i}.png',
                analysis_status='completed', sort_order=i)
            a.set_analysis({'template_role': 'content',
                             'layout_structure': 'x',
                             'content_capacity': 'medium',
                             'visual_density': 'medium',
                             'style_keywords': ['x']})
            db.session.add(a)

        for i in range(60):  # > BATCH_PAGES (50) → batching
            p = Page(id=str(uuid.uuid4()), project_id=proj_id, order_index=i)
            p.set_description_content({
                'title': f'P{i}',
                'text_content': ['hello'],
            })
            db.session.add(p)
        db.session.commit()

    call_count = {'n': 0, 'pages_per_call': []}

    class FakeAIService(AIService):
        def __init__(self):
            pass

        def generate_json(self, prompt, thinking_budget=1000):
            call_count['n'] += 1
            import re
            match = re.search(r'"待匹配页面"|"Pages to match"', prompt)
            count = prompt.count('"page_id":')
            call_count['pages_per_call'].append(count)
            return [{'page_id': '?', 'template_asset_id': None,
                      'status': 'undecided', 'confidence': 0.0,
                      'reason': 'fake'}]

    with app.app_context():
        svc = FakeAIService()
        results = svc.auto_match_templates(proj_id)

    assert call_count['n'] >= 2  # at least 2 batches
    # The prompt schema example mentions "page_id" once, so subtract that
    # template overhead and assert each batch holds <= 30 actual pages.
    actual_pages_per_call = [c - 1 for c in call_count['pages_per_call']]
    assert max(actual_pages_per_call) <= 30


def test_auto_match_endpoint_missing_descriptions_400(client, stub_submit_task):
    from models import db, Page
    project_id = _make_project(client)
    _upload_asset(client, project_id)

    # Add a page WITHOUT description
    with client.application.app_context():
        page = Page(id=str(uuid.uuid4()), project_id=project_id, order_index=0)
        db.session.add(page)
        db.session.commit()

    resp = client.post(
        f'/api/projects/{project_id}/template-assets/auto-match',
        json={'overwrite_existing': True, 'preserve_non_empty': False})
    assert resp.status_code == 400
    err = resp.get_json()['error']
    assert err['code'] == 'MISSING_DESCRIPTIONS'
