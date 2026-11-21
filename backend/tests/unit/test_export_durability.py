from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
import json
from pathlib import Path
import threading
import uuid

from filelock import FileLock
from PIL import Image
from pptx import Presentation
import pytest

from models import db, Project, Page, Task, ExportRun
from export_runtime.checkpoints import file_hash
from export_runtime.control import ExportAborted
from export_runtime.tasks import workspace, publish, reconcile, fail, artifact_allowed


@pytest.fixture
def export_project(client, app, monkeypatch):
    project = Project(creation_type='idea', idea_prompt='durable export')
    db.session.add(project)
    db.session.flush()
    folder = Path(app.config['UPLOAD_FOLDER']) / project.id / 'pages'
    folder.mkdir(parents=True)
    pages = []
    for index in range(2):
        image = folder / f'{index}.png'
        Image.new('RGB', (320, 180), (index, 0, 0)).save(image)
        page = Page(project_id=project.id, order_index=index,
                    generated_image_path=f'{project.id}/pages/{index}.png')
        db.session.add(page)
        pages.append(page)
    db.session.commit()
    dispatched = []
    monkeypatch.setattr('services.task_manager.task_manager.submit_task',
                        lambda task_id, *_args, **_kwargs: dispatched.append(task_id))
    return project, pages, dispatched


def create(client, project, **data):
    return client.post(f'/api/projects/{project.id}/export/editable-pptx',
                       json={'export_mode': 'simple', **data})


def test_idempotent_submission_rejects_changed_parameters(client, export_project):
    project, pages, dispatched = export_project
    request_id = str(uuid.uuid4())
    first = create(client, project, client_task_id=request_id)
    assert first.status_code == 200
    assert create(client, project, client_task_id=request_id).json['data']['reused']
    assert create(client, project, client_task_id=request_id, page_ids=[pages[0].id]).status_code == 409
    assert dispatched == [request_id]


def test_public_export_defaults_to_text_only_and_rejects_full(client, app, monkeypatch, export_project):
    project, _, dispatched = export_project
    full_response = create(client, project, export_mode='full')
    assert full_response.status_code == 200
    full_task_id = full_response.json['data']['task_id']
    fail(full_task_id, RuntimeError('old full export'))
    monkeypatch.setitem(app.config, 'PUBLIC_DEMO', True)

    endpoint = f'/api/projects/{project.id}/export/editable-pptx'
    headers = {'X-User-Token': 'public-visitor-export-test-108'}
    assert client.post(endpoint, json={'export_mode': 'full'}, headers=headers).status_code == 400
    assert client.post(endpoint, json={'resume_from_task_id': full_task_id}, headers=headers).status_code == 400

    response = client.post(endpoint, json={}, headers=headers)
    assert response.status_code == 200, response.json
    task_id = response.json['data']['task_id']
    assert response.json['data']['export_mode'] == 'simple'
    options = json.loads(db.session.get(ExportRun, task_id).request_json)['options']
    assert options['export_inpaint_method'] == 'generative'
    assert options['enable_icon_subject_extraction'] is False
    assert dispatched == [full_task_id, task_id]


def test_dedicated_supervisors_isolate_visitor_configuration(app, monkeypatch):
    from queue import Queue

    from export_runtime.tasks import _worker_config
    from services.public_demo import PROFILES, visitor_scope
    from services.task_manager import TaskManager

    monkeypatch.setitem(app.config, 'PUBLIC_DEMO', True)
    monkeypatch.setitem(app.config, 'PUBLIC_DEMO_BAIDU_API_KEY', 'site-managed-ocr-key')
    monkeypatch.setitem(app.config, 'OPENAI_API_KEY', 'unrelated-global-key')
    received = Queue()

    def sample(task_id, app):
        with app.app_context():
            received.put((task_id, _worker_config(app)))

    sample._dedicated_export_supervisor = True
    manager = TaskManager(max_workers=1)
    keys_by_partner = {'inferera': 'visitor-inferera-key', 'volcengine': 'visitor-volcengine-key'}
    for partner, key in keys_by_partner.items():
        snapshot = {'token': partner, 'config': {'partner': partner, 'provider_keys': {partner: key},
                                                    'baidu_api_key': 'visitor-ocr-key'}}
        with app.app_context(), visitor_scope(snapshot):
            manager.submit_task(partner, sample, app=app)

    snapshots = dict(received.get(timeout=5) for _ in keys_by_partner)
    for partner, key in keys_by_partner.items():
        config = snapshots[partner]
        assert config['IMAGE_API_KEY'] == key
        assert config['IMAGE_CAPTION_API_KEY'] == key
        assert config['BAIDU_API_KEY'] == 'site-managed-ocr-key'
        assert config['IMAGE_MODEL'] == PROFILES[partner]['image']
        assert 'unrelated-global-key' not in config.values()
        assert 'MINERU_TOKEN' not in config


def test_concurrent_resume_has_one_successor_and_preserves_order_options(client, app, export_project):
    project, pages, dispatched = export_project
    task_id = create(client, project, page_ids=[page.id for page in pages]).json['data']['task_id']
    fail(task_id, RuntimeError('injected failure'))
    pages[0].order_index, pages[1].order_index = 1, 0
    project.export_allow_partial = True
    db.session.commit()
    project_id = project.id
    barrier = threading.Barrier(2)
    def resume(_):
        with app.test_client() as requester:
            barrier.wait()
            response = requester.post(f'/api/projects/{project_id}/export/editable-pptx',
                json={'resume_from_task_id': task_id, 'client_task_id': str(uuid.uuid4())})
            assert response.status_code == 200, response.json
            return response.json['data']['task_id']
    with ThreadPoolExecutor(max_workers=2) as pool:
        successors = list(pool.map(resume, range(2)))
    assert successors[0] == successors[1]
    assert len(dispatched) == 2
    db.session.expire_all()
    resumed = db.session.get(ExportRun, successors[0])
    original = db.session.get(ExportRun, task_id)
    assert json.loads(resumed.request_json)['options'] == json.loads(original.request_json)['options']
    assert [page['id'] for page in json.loads(resumed.request_json)['pages']] == [page.id for page in pages]


def test_resume_waits_until_old_owner_is_retired_and_rejects_missing_page(client, app, export_project):
    project, pages, _ = export_project
    task_id = create(client, project).json['data']['task_id']
    fail(task_id, RuntimeError('failed'))
    root = workspace(app, project.id, task_id)
    root.mkdir(parents=True)
    with FileLock(str(root / 'owner.lock')):
        assert create(client, project, resume_from_task_id=task_id).status_code == 409
    db.session.delete(pages[1])
    db.session.commit()
    assert create(client, project, resume_from_task_id=task_id).status_code == 400


def test_foreign_resume_and_incomplete_selection_are_rejected(client, export_project):
    project, pages, _ = export_project
    task_id = create(client, project).json['data']['task_id']
    fail(task_id, RuntimeError('failed'))
    foreign = Project(creation_type='idea', idea_prompt='other')
    db.session.add(foreign)
    db.session.commit()
    assert create(client, foreign, resume_from_task_id=task_id).status_code == 404
    assert create(client, project, page_ids=[pages[0].id, str(uuid.uuid4())]).status_code == 400


def test_reconcile_keeps_live_owner_and_marks_interrupted_task_resumable(client, app, export_project):
    project, _, _ = export_project
    task_id = create(client, project).json['data']['task_id']
    task = db.session.get(Task, task_id)
    task.created_at = datetime.utcnow() - timedelta(seconds=30)
    db.session.commit()
    root = workspace(app, project.id, task_id)
    root.mkdir(parents=True)
    with FileLock(str(root / 'supervisor.lock')):
        reconcile(task, app)
        assert task.status == 'PENDING'
    reconcile(task, app)
    assert task.status == 'FAILED'
    assert task.get_progress()['error_code'] == 'EXPORT_INTERRUPTED'
    assert create(client, project, resume_from_task_id=task_id).status_code == 200


def result_file(app, run):
    root = workspace(app, run.project_id, run.task_id)
    root.mkdir(parents=True, exist_ok=True)
    source = root / 'result.pptx'
    deck = Presentation()
    for _ in range(2):
        deck.slides.add_slide(deck.slide_layouts[6])
    deck.save(source)
    return {'path': str(source), 'sha256': file_hash(source), 'pages': 2,
            'warnings': [], 'warning_details': {}, 'reused_nodes': 2}


def test_terminal_fence_rejects_late_publish_and_uncommitted_files(client, app, export_project):
    project, _, _ = export_project
    task_id = create(client, project).json['data']['task_id']
    run = db.session.get(ExportRun, task_id)
    result = result_file(app, run)
    fail(task_id, RuntimeError('stopped'))
    with pytest.raises(ExportAborted):
        publish(app, run, result, 2)
    assert db.session.get(Task, task_id).status == 'FAILED'
    assert not artifact_allowed(project.id, run.artifact_filename)
    destination = Path(app.config['UPLOAD_FOLDER']) / project.id / 'exports' / run.artifact_filename
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(b'uncommitted output after crash')
    assert client.get(f'/files/{project.id}/exports/{run.artifact_filename}').status_code == 404
    reconcile(db.session.get(Task, task_id), app)
    assert not destination.exists()


def test_published_artifact_requires_manifest_hash_and_exact_slide_count(client, app, export_project):
    project, _, _ = export_project
    task_id = create(client, project).json['data']['task_id']
    run = db.session.get(ExportRun, task_id)
    result = result_file(app, run)
    with pytest.raises(ValueError):
        publish(app, run, {**result, 'pages': 1}, 1)
    assert db.session.get(Task, task_id).status == 'PENDING'
    publish(app, run, result, 2)
    assert artifact_allowed(project.id, run.artifact_filename, verify=True)
    destination = Path(app.config['UPLOAD_FOLDER']) / project.id / 'exports' / run.artifact_filename
    destination.write_bytes(b'corrupted')
    assert client.get(f'/files/{project.id}/exports/{run.artifact_filename}').status_code == 404


def test_admission_cap_returns_bounded_queue_error(client, app, monkeypatch, export_project):
    project, _, dispatched = export_project
    monkeypatch.setitem(app.config, 'EXPORT_QUEUE_LIMIT', 1)
    assert create(client, project).status_code == 200
    second = create(client, project)
    assert second.status_code == 429
    assert len(dispatched) == 1


def test_publish_commit_failure_removes_renamed_artifact(client, app, monkeypatch, export_project):
    project, _, _ = export_project
    task_id = create(client, project).json['data']['task_id']
    run = db.session.get(ExportRun, task_id)
    result = result_file(app, run)
    with monkeypatch.context() as patch:
        patch.setattr(db.session, 'commit', lambda: (_ for _ in ()).throw(RuntimeError('commit failed')))
        with pytest.raises(RuntimeError, match='commit failed'):
            publish(app, run, result, 2)
    destination = Path(app.config['UPLOAD_FOLDER']) / project.id / 'exports' / run.artifact_filename
    assert not destination.exists()
    assert db.session.get(Task, task_id).status == 'PENDING'
    assert not artifact_allowed(project.id, run.artifact_filename)


def test_project_deletion_removes_durable_attempts(client, export_project):
    project, _, _ = export_project
    task_id = create(client, project).json['data']['task_id']
    db.session.delete(project)
    db.session.commit()
    assert db.session.get(Task, task_id) is None
    assert db.session.get(ExportRun, task_id) is None
