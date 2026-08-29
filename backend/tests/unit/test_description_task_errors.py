from unittest.mock import patch

from models import db, Page, Project, Task
from services.task_manager import generate_descriptions_task
from utils.ai_errors import prioritized_generation_error_message


def _create_description_project(client, page_count=2):
    project_response = client.post('/api/projects', json={
        'creation_type': 'idea',
        'idea_prompt': '并行描述错误恢复测试',
    })
    project_id = project_response.get_json()['data']['project_id']

    for index in range(page_count):
        page_response = client.post(f'/api/projects/{project_id}/pages', json={
            'order_index': index,
            'outline_content': {'title': f'第 {index + 1} 页', 'points': ['要点']},
        })
        assert page_response.status_code == 201

    return project_id


def _create_task(project_id):
    task = Task(
        project_id=project_id,
        task_type='GENERATE_DESCRIPTIONS',
        status='PENDING',
    )
    db.session.add(task)
    db.session.commit()
    return task.id


def test_parallel_description_failure_sets_safe_failed_task(app, client):
    project_id = _create_description_project(client)

    with app.app_context():
        task_id = _create_task(project_id)

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


def test_parallel_description_regeneration_failure_preserves_generated_project_status(app, client):
    project_id = _create_description_project(client)

    with app.app_context():
        pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()
        for index, page in enumerate(pages, 1):
            page.set_description_content({'text': f'已有描述 {index}'})
            page.status = 'DESCRIPTION_GENERATED'
        project = db.session.get(Project, project_id)
        project.status = 'DESCRIPTIONS_GENERATED'
        db.session.commit()
        task_id = _create_task(project_id)

    class FailingAIService:
        def flatten_outline(self, outline):
            return outline

        def generate_page_description(self, *args, **kwargs):
            raise RuntimeError('401 invalid API key')

    outline = [
        {'title': '第一页', 'points': ['要点']},
        {'title': '第二页', 'points': ['要点']},
    ]

    with patch('services.ai_service_manager.get_ai_service', return_value=FailingAIService()):
        generate_descriptions_task(
            task_id,
            project_id,
            FailingAIService(),
            object(),
            outline,
            max_workers=2,
            app=app,
            language='zh',
        )

    with app.app_context():
        task = db.session.get(Task, task_id)
        project = db.session.get(Project, project_id)
        pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()

        assert task.status == 'FAILED'
        assert task.get_progress() == {'total': 2, 'completed': 0, 'failed': 2}
        assert project.status == 'DESCRIPTIONS_GENERATED'
        assert [page.get_description_content()['text'] for page in pages] == [
            '已有描述 1',
            '已有描述 2',
        ]


def test_parallel_description_page_count_mismatch_recovers_project_and_pages(app, client):
    project_id = _create_description_project(client)

    with app.app_context():
        project = db.session.get(Project, project_id)
        project.status = 'GENERATING_DESCRIPTIONS'
        task_id = _create_task(project_id)

    class MismatchedAIService:
        def flatten_outline(self, outline):
            return outline[:1]

    generate_descriptions_task(
        task_id,
        project_id,
        MismatchedAIService(),
        object(),
        [{'title': '只有一页', 'points': ['要点']}],
        app=app,
    )

    with app.app_context():
        task = db.session.get(Task, task_id)
        project = db.session.get(Project, project_id)
        pages = Page.query.filter_by(project_id=project_id).all()

        assert task.status == 'FAILED'
        assert task.error_message == 'Generation failed due to an internal error'
        assert task.get_progress() == {'total': 2, 'completed': 0, 'failed': 2}
        assert project.status == 'OUTLINE_GENERATED'
        assert all(page.status == 'DRAFT' for page in pages)


def test_outer_description_failure_does_not_count_existing_descriptions_as_task_success(app, client):
    project_id = _create_description_project(client)

    with app.app_context():
        pages = Page.query.filter_by(project_id=project_id).all()
        for index, page in enumerate(pages, 1):
            page.set_description_content({'text': f'已有描述 {index}'})
            page.status = 'DESCRIPTION_GENERATED'
        project = db.session.get(Project, project_id)
        project.status = 'GENERATING_DESCRIPTIONS'
        db.session.commit()
        task_id = _create_task(project_id)

    class MismatchedAIService:
        def flatten_outline(self, outline):
            return outline[:1]

    generate_descriptions_task(
        task_id,
        project_id,
        MismatchedAIService(),
        object(),
        [{'title': '只有一页', 'points': ['要点']}],
        app=app,
    )

    with app.app_context():
        task = db.session.get(Task, task_id)
        project = db.session.get(Project, project_id)
        pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()

        assert task.status == 'FAILED'
        assert task.get_progress() == {'total': 2, 'completed': 0, 'failed': 2}
        assert project.status == 'DESCRIPTIONS_GENERATED'
        assert [page.get_description_content()['text'] for page in pages] == [
            '已有描述 1',
            '已有描述 2',
        ]


def test_parallel_description_future_failure_restores_generating_pages(app, client):
    project_id = _create_description_project(client)

    with app.app_context():
        project = db.session.get(Project, project_id)
        project.status = 'GENERATING_DESCRIPTIONS'
        task_id = _create_task(project_id)

    class SuccessfulAIService:
        def flatten_outline(self, outline):
            return outline

        def generate_page_description(self, *args, **kwargs):
            return {'text': '不会提交的描述'}

    class ExplodingFuture:
        def result(self):
            raise RuntimeError('future collection failed with secret detail')

    outline = [
        {'title': '第一页', 'points': ['要点']},
        {'title': '第二页', 'points': ['要点']},
    ]

    with (
        patch('services.ai_service_manager.get_ai_service', return_value=SuccessfulAIService()),
        patch('services.task_manager.as_completed', return_value=[ExplodingFuture()]),
        patch.object(db.session, 'rollback', wraps=db.session.rollback) as rollback,
    ):
        generate_descriptions_task(
            task_id,
            project_id,
            SuccessfulAIService(),
            object(),
            outline,
            max_workers=2,
            app=app,
        )

    assert rollback.call_count >= 1

    with app.app_context():
        task = db.session.get(Task, task_id)
        project = db.session.get(Project, project_id)
        pages = Page.query.filter_by(project_id=project_id).all()

        assert task.status == 'FAILED'
        assert task.error_message == 'Generation failed due to an internal error'
        assert 'secret detail' not in task.error_message
        assert project.status == 'OUTLINE_GENERATED'
        assert all(page.status == 'DRAFT' for page in pages)


def test_description_endpoint_persists_generating_state_before_submit(app, client):
    project_id = _create_description_project(client, page_count=1)

    class OutlineOnlyAIService:
        pass

    def assert_persisted_before_submit(task_id, *_args, **_kwargs):
        project = db.session.get(Project, project_id)
        task = db.session.get(Task, task_id)
        assert project.status == 'GENERATING_DESCRIPTIONS'
        assert task.status == 'PENDING'

    with (
        patch('controllers.project_controller.get_ai_service', return_value=OutlineOnlyAIService()),
        patch('controllers.project_controller._get_project_reference_files_content', return_value=[]),
        patch('controllers.project_controller.task_manager.submit_task', side_effect=assert_persisted_before_submit),
    ):
        response = client.post(f'/api/projects/{project_id}/generate/descriptions', json={})

    assert response.status_code == 202


def test_description_endpoint_safely_surfaces_provider_initialization_failure(app, client):
    project_id = _create_description_project(client, page_count=1)

    with patch(
        'controllers.project_controller.get_ai_service',
        side_effect=ValueError('GOOGLE_API_KEY (from database settings or environment) is required'),
    ):
        response = client.post(f'/api/projects/{project_id}/generate/descriptions', json={})

    assert response.status_code == 503
    assert response.get_json()['error']['message'] == 'API key is invalid'

    with app.app_context():
        project = db.session.get(Project, project_id)
        tasks = Task.query.filter_by(project_id=project_id).all()
        assert project.status != 'GENERATING_DESCRIPTIONS'
        assert tasks == []


def test_parallel_description_batch_prefers_actionable_provider_error():
    message = prioritized_generation_error_message([
        'unexpected parser failure with private details',
        'quota exhausted for provider account 123',
    ])

    assert message == 'API quota or balance is insufficient'
