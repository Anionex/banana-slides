from pathlib import Path
import json
import time
import uuid

from PIL import Image
import pytest

from models import Page, Project, Task, ExportRun, db
from services.export_service import ExportError, ExportService
from services.task_manager import export_editable_pptx_with_recursive_analysis_task


class FileServiceStub:
    def __init__(self, image_path: Path):
        self.image_path = image_path

    def get_absolute_path(self, _relative_path: str) -> str:
        return str(self.image_path)


def test_editable_export_task_preserves_progress_and_structured_failure(
    app,
    db_session,
    tmp_path,
    monkeypatch,
):
    image_path = tmp_path / "slide.png"
    Image.new("RGB", (320, 180), color="white").save(image_path)

    project = Project(creation_type="idea", idea_prompt="demo")
    db.session.add(project)
    db.session.flush()
    db.session.add(Page(
        project_id=project.id,
        order_index=0,
        generated_image_path="pages/slide.png",
    ))
    task = Task(
        project_id=project.id,
        task_type="EXPORT_EDITABLE_PPTX",
        status="PENDING",
    )
    db.session.add(task)
    db.session.commit()
    db.session.add(ExportRun(task_id=task.id, project_id=project.id,
        request_json=json.dumps({'pages': [{'id': 'page'}], 'options': {'export_mode': 'full'}}),
        request_hash='a' * 64, artifact_filename=f'editable-run-{task.id}-demo.pptx',
        queue_deadline_at=time.time() + 30))
    db.session.commit()

    monkeypatch.setattr(
        "services.image_editability.TextAttributeExtractorFactory.create_caption_model_extractor",
        lambda: object(),
    )

    def fail_during_style_extraction(*_args, progress_callback=None, **_kwargs):
        progress_callback("样式提取", "正在分析 12 个文本元素...", 50)
        raise ExportError(
            message="文本样式提取失败：图片识别服务请求超时",
            error_type="style_extraction",
            error_code="EXPORT_STYLE_TIMEOUT",
            stage="style_extraction",
            details={
                "stage": "style_extraction",
                "reason": "timeout",
                "provider": "CodexTextProvider",
                "model": "gpt-5.4",
                "retryable": True,
            },
            help_text="请稍后重试。",
        )

    monkeypatch.setattr(
        ExportService,
        "create_editable_pptx_with_recursive_analysis",
        fail_during_style_extraction,
    )
    from export_runtime.process import WorkerFailed
    def worker(_payload, on_event, is_active):
        try:
            fail_during_style_extraction(progress_callback=lambda step, message, percent: on_event(
                {'event': 'progress', 'stage': step, 'label': message, 'percent': percent}))
        except ExportError as error:
            raise WorkerFailed({'message': str(error), 'details': error.to_dict()}) from error
    monkeypatch.setattr('export_runtime.process.supervise', worker)

    export_editable_pptx_with_recursive_analysis_task(
        task_id=task.id,
        project_id=project.id,
        filename="demo.pptx",
        file_service=FileServiceStub(image_path),
        app=app,
    )

    db.session.expire_all()
    failed_task = db.session.get(Task, task.id)
    progress = failed_task.get_progress()

    assert failed_task.status == "FAILED"
    assert failed_task.error_message == "文本样式提取失败：图片识别服务请求超时"
    assert "请稍后重试" not in failed_task.error_message
    assert progress["percent"] == 50
    assert progress["completed"] == 50
    assert progress["backend_status"] == "FAILED"
    assert progress["error_code"] == "EXPORT_STYLE_TIMEOUT"
    assert progress["error_stage"] == "style_extraction"
    assert progress["error_details"]["provider"] == "CodexTextProvider"
    assert progress["error_details"]["model"] == "gpt-5.4"
    assert progress["help_text"].startswith("请稍后重试。")
    assert progress['resumable'] is True


def test_editable_export_creation_is_idempotent_with_client_task_id(
    app,
    client,
    monkeypatch,
):
    with app.app_context():
        project = Project(creation_type="idea", idea_prompt="demo")
        db.session.add(project)
        db.session.flush()
        db.session.add(Page(
            project_id=project.id,
            order_index=0,
            generated_image_path=f"{project.id}/pages/slide.png",
        ))
        db.session.commit()
        project_id = project.id
        image_path = Path(app.config['UPLOAD_FOLDER']) / project_id / 'pages/slide.png'
        image_path.parent.mkdir(parents=True, exist_ok=True)
        Image.new('RGB', (320, 180), 'white').save(image_path)

    submitted = []
    monkeypatch.setattr(
        "services.task_manager.task_manager.submit_task",
        lambda task_id, *_args, **_kwargs: submitted.append(task_id),
    )
    client_task_id = str(uuid.uuid4())
    payload = {"client_task_id": client_task_id}

    first = client.post(
        f"/api/projects/{project_id}/export/editable-pptx",
        json=payload,
    )
    second = client.post(
        f"/api/projects/{project_id}/export/editable-pptx",
        json=payload,
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.get_json()["data"]["task_id"] == client_task_id
    assert second.get_json()["data"]["task_id"] == client_task_id
    assert second.get_json()["data"]["reused"] is True
    assert submitted == [client_task_id]
    with app.app_context():
        assert db.session.query(Task).filter_by(id=client_task_id).count() == 1


def test_editable_export_rejects_invalid_client_task_id(client, sample_project):
    project_id = sample_project["project_id"]

    response = client.post(
        f"/api/projects/{project_id}/export/editable-pptx",
        json={"client_task_id": "not-a-uuid"},
    )

    assert response.status_code == 400
    assert response.get_json()["error"]["message"] == "client_task_id must be a valid UUID"


def test_editable_export_records_task_submission_failure(
    app,
    client,
    monkeypatch,
):
    with app.app_context():
        project = Project(creation_type="idea", idea_prompt="demo")
        db.session.add(project)
        db.session.flush()
        db.session.add(Page(
            project_id=project.id,
            order_index=0,
            generated_image_path=f"{project.id}/pages/slide.png",
        ))
        db.session.commit()
        project_id = project.id
        image_path = Path(app.config['UPLOAD_FOLDER']) / project_id / 'pages/slide.png'
        image_path.parent.mkdir(parents=True, exist_ok=True)
        Image.new('RGB', (320, 180), 'white').save(image_path)

    def reject_submission(*_args, **_kwargs):
        raise RuntimeError("executor rejected task with access_token=secret-value")

    monkeypatch.setattr(
        "services.task_manager.task_manager.submit_task",
        reject_submission,
    )
    client_task_id = str(uuid.uuid4())

    response = client.post(
        f"/api/projects/{project_id}/export/editable-pptx",
        json={"client_task_id": client_task_id},
    )

    assert response.status_code == 503
    assert response.get_json()["error"]["code"] == "EXPORT_TASK_SUBMISSION_FAILED"
    with app.app_context():
        failed_task = db.session.get(Task, client_task_id)
        progress = failed_task.get_progress()
        assert failed_task.status == "FAILED"
        assert progress["error_code"] == "EXPORT_TASK_SUBMISSION_FAILED"
        assert progress["error_stage"] == "queue_submission"
        assert progress["error_details"]["retryable"] is True
        assert "secret-value" not in progress["error_details"]["technical_message"]


@pytest.mark.parametrize('message', [
    'Baidu API error [17]: Open api daily request limit reached',
    'Baidu API error [19]: Open api total request limit reached',
    'Error code: 429 - insufficient_quota',
])
def test_exhausted_quota_has_actionable_nonretryable_error(message):
    error = ExportService._build_unexpected_export_error(message, 'export_pipeline')
    assert error.error_code == 'EXPORT_QUOTA_EXHAUSTED'
    assert error.error_type == 'service'
    assert error.details['retryable'] is False
    assert '额度已耗尽' in str(error)
    assert '配额恢复' in error.help_text
    style_error = ExportService._build_style_extraction_error(message)
    assert style_error.error_code == 'EXPORT_STYLE_QUOTA_EXHAUSTED'
    assert style_error.details['retryable'] is False
    assert '配额恢复' in style_error.help_text


def test_qps_limit_remains_transient():
    error = ExportService._build_unexpected_export_error(
        'Baidu API error [18]: Open api qps request limit reached', 'export_pipeline')
    assert error.error_code == 'EXPORT_RATE_LIMIT'
    assert error.details['retryable'] is True


def test_erasure_quality_failure_survives_worker_serialization(app, db_session):
    from export_runtime.process import WorkerFailed
    from export_runtime.tasks import fail
    from services.image_editability.text_restoration import TextErasureQualityFailure

    project = Project(creation_type='idea', idea_prompt='quality failure')
    db.session.add(project)
    db.session.flush()
    task = Task(project_id=project.id, task_type='EXPORT_EDITABLE_PPTX', status='RUNNING')
    task.set_progress({'percent': 22, 'completed': 22, 'total': 100})
    db.session.add(task)
    db.session.commit()
    error = TextErasureQualityFailure(2, '目标区域仍有文字：Hello')
    fail(task.id, WorkerFailed({'message': str(error), 'details': error.to_dict()}))
    db.session.expire_all()
    failed = db.session.get(Task, task.id)
    progress = failed.get_progress()
    assert failed.status == 'FAILED'
    assert failed.error_message == '自动重试后仍未通过背景去字校验'
    assert progress['error_code'] == 'EXPORT_TEXT_ERASURE_QUALITY'
    assert progress['error_stage'] == 'text_erasure'
    assert progress['error_details']['attempts'] == 2
    assert 'Hello' in progress['error_details']['technical_message']
    assert progress['percent'] == 22
    assert progress['resumable'] is True
    assert progress['download_url'] is None
    assert '断点继续' in progress['help_text']


def test_daily_quota_stops_after_one_call_and_preserves_resume(app, db_session, tmp_path):
    from export_runtime.control import ExportControl, request
    from export_runtime.process import WorkerFailed
    from export_runtime.tasks import fail

    project = Project(creation_type='idea', idea_prompt='quota failure')
    db.session.add(project)
    db.session.flush()
    task = Task(project_id=project.id, task_type='EXPORT_EDITABLE_PPTX', status='RUNNING')
    task.set_progress({'percent': 5, 'completed': 5, 'total': 100})
    db.session.add(task)
    db.session.commit()
    calls = []

    def upstream():
        calls.append(1)
        raise RuntimeError('Baidu API error [17]: Open api daily request limit reached')

    with ExportControl(tmp_path).bind(), pytest.raises(RuntimeError) as caught:
        request('image', upstream, attempts=3)
    assert len(calls) == 1
    fail(task.id, WorkerFailed({'message': str(caught.value)}))
    db.session.expire_all()
    failed = db.session.get(Task, task.id)
    progress = failed.get_progress()
    assert failed.status == 'FAILED'
    assert progress['error_code'] == 'EXPORT_QUOTA_EXHAUSTED'
    assert progress['error_details']['retryable'] is False
    assert progress['percent'] == 5
    assert progress['resumable'] is True
    assert progress['download_url'] is None
