from models import Page, Project, Task, db


def test_editable_pptx_export_marks_task_failed_when_submit_fails(client, app, monkeypatch):
    from services import task_manager as tm

    with app.app_context():
        project = Project(
            idea_prompt='editable export submit failure',
            creation_type='idea',
            status='COMPLETED',
        )
        db.session.add(project)
        db.session.flush()
        page = Page(
            project_id=project.id,
            order_index=0,
            generated_image_path='pages/slide.png',
            status='COMPLETED',
        )
        db.session.add(page)
        db.session.commit()
        project_id = project.id

    def _fail_submit(*args, **kwargs):
        raise RuntimeError('editable export queue full')

    monkeypatch.setattr(tm.task_manager, 'submit_task', _fail_submit)

    response = client.post(
        f'/api/projects/{project_id}/export/editable-pptx',
        json={'text_only': True},
    )

    assert response.status_code == 500
    with app.app_context():
        task = Task.query.filter_by(
            project_id=project_id,
            task_type='EXPORT_EDITABLE_PPTX',
        ).one()
        assert task.status == 'FAILED'
        assert 'Task submission failed: editable export queue full' in task.error_message
        assert task.completed_at is not None
