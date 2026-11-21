from contextlib import contextmanager
from unittest.mock import Mock

import pytest
from sqlalchemy import event

from models import Page, Task, db
from services import task_manager


@pytest.mark.parametrize('worker', [
    'generate_descriptions_task',
    'generate_images_task',
    'generate_single_page_image_task',
    'edit_page_image_task',
])
def test_generation_failure_can_persist_status_after_failed_flush(worker, sample_project, app, monkeypatch):
    project_id = sample_project['project_id']
    single_page = worker in ('generate_single_page_image_task', 'edit_page_image_task')
    page = Page(project_id=project_id, order_index=0, generated_image_path='existing-slide.png')
    task = Task(
        project_id=project_id,
        task_type='GENERATE_IMAGES',
        status='PROCESSING' if worker == 'generate_single_page_image_task' else 'PENDING',
    )
    db.session.add_all([page, task])
    db.session.commit()
    task_id, page_id = task.id, page.id

    def fail_nonterminal_update(_mapper, _connection, target):
        if target.id == task_id and target.status != 'FAILED':
            raise RuntimeError('fixture task flush failed')

    @contextmanager
    def acquire_image_slot(_label, *, on_acquire):
        on_acquire()
        yield

    monkeypatch.setattr(task_manager.image_resource_limiter, 'slot', acquire_image_slot)
    ai_service = Mock()
    file_service = Mock()
    event.listen(Task, 'before_update', fail_nonterminal_update)
    try:
        if worker == 'generate_descriptions_task':
            task_manager.generate_descriptions_task(task_id, project_id, ai_service, None, [], app=app)
        elif worker == 'generate_images_task':
            task_manager.generate_images_task(task_id, project_id, ai_service, file_service, [], app=app)
        elif worker == 'generate_single_page_image_task':
            task_manager.generate_single_page_image_task(
                task_id, project_id, page_id, ai_service, file_service, [], app=app,
            )
        else:
            task_manager.edit_page_image_task(
                task_id, project_id, page_id, 'fixture instruction', ai_service, file_service, app=app,
            )
    finally:
        event.remove(Task, 'before_update', fail_nonterminal_update)

    db.session.expire_all()
    saved_task = db.session.get(Task, task_id)
    assert saved_task.status == 'FAILED'
    assert saved_task.error_message == 'fixture task flush failed'
    assert saved_task.completed_at is not None
    if single_page:
        assert db.session.get(Page, page_id).status == 'FAILED'
    assert not ai_service.method_calls
