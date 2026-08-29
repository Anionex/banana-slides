from unittest.mock import patch

from models import db, Page, Project, Task
from services.task_manager import generate_descriptions_task


def test_parallel_description_failure_sets_safe_failed_task(app, client):
    project_response = client.post('/api/projects', json={
        'creation_type': 'idea',
        'idea_prompt': '并行描述错误恢复测试',
    })
    project_id = project_response.get_json()['data']['project_id']

    for index in range(2):
        page_response = client.post(f'/api/projects/{project_id}/pages', json={
            'order_index': index,
            'outline_content': {'title': f'第 {index + 1} 页', 'points': ['要点']},
        })
        assert page_response.status_code == 201

    with app.app_context():
        task = Task(
            project_id=project_id,
            task_type='GENERATE_DESCRIPTIONS',
            status='PENDING',
        )
        db.session.add(task)
        db.session.commit()
        task_id = task.id

    class FailingAIService:
        def flatten_outline(self, outline):
            return outline

        def generate_page_description(self, *args, **kwargs):
            raise RuntimeError('401 invalid API key: secret-provider-detail')

    ai_service = FailingAIService()
    outline = [
        {'title': '第一页', 'points': ['要点']},
        {'title': '第二页', 'points': ['要点']},
    ]

    with patch('services.ai_service_manager.get_ai_service', return_value=ai_service):
        generate_descriptions_task(
            task_id,
            project_id,
            ai_service,
            object(),
            outline,
            max_workers=2,
            app=app,
            language='zh',
        )

    with app.app_context():
        task = db.session.get(Task, task_id)
        project = db.session.get(Project, project_id)
        pages = Page.query.filter_by(project_id=project_id).all()

        assert task.status == 'FAILED'
        assert task.error_message == 'API key is invalid'
        assert 'secret-provider-detail' not in task.error_message
        assert task.get_progress() == {'total': 2, 'completed': 0, 'failed': 2}
        assert project.status == 'OUTLINE_GENERATED'
        assert all(page.status == 'FAILED' for page in pages)
