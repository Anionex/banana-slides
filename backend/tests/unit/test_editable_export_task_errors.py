from pathlib import Path
import uuid

from PIL import Image

from models import Page, Project, Task, db
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
    assert progress["help_text"] == "请稍后重试。"


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
