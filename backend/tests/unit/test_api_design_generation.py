from unittest.mock import MagicMock, patch

from conftest import assert_success_response
from models import db, Page, Project, Task


def _create_project_with_pages(template_style='modern style', creation_type='idea'):
    project = Project(
        creation_type=creation_type,
        idea_prompt='design generation test',
        outline_text='第一页\n第二页',
        template_style=template_style,
        status='OUTLINE_GENERATED',
    )
    db.session.add(project)
    db.session.flush()

    page1 = Page(project_id=project.id, order_index=0, status='DESCRIPTION_GENERATED')
    page1.set_outline_content({'title': '封面', 'points': ['标题']})
    page1.set_description_content({'text': '封面描述', 'generated_at': '2026-04-14T00:00:00'})
    page1.set_design_content({'text': '旧设计 1', 'generated_at': '2026-04-14T00:00:00'})

    page2 = Page(project_id=project.id, order_index=1, status='DESCRIPTION_GENERATED')
    page2.set_outline_content({'title': '内容页', 'points': ['要点']})
    page2.set_description_content({'text': '内容页描述', 'generated_at': '2026-04-14T00:00:00'})
    page2.set_design_content({'text': '旧设计 2', 'generated_at': '2026-04-14T00:00:00'})

    db.session.add_all([page1, page2])
    db.session.commit()
    return project, page1, page2


def _mock_sync_submit_task(task_id, func, *args, **kwargs):
    func(task_id, *args, **kwargs)


def _build_mock_ai_service():
    ai = MagicMock()
    ai.generate_outline_text.return_value = '1. 封面\n2. 内容页'
    ai.generate_page_design.side_effect = lambda **kwargs: f"布局方式：{kwargs['page_description']}"
    ai.parse_outline_text.return_value = [
        {'title': '新封面', 'points': ['新标题']},
        {'title': '新内容页', 'points': ['新要点']},
    ]
    ai.flatten_outline.return_value = [
        {'title': '新封面', 'points': ['新标题']},
        {'title': '新内容页', 'points': ['新要点']},
    ]
    return ai


class TestDesignGenerationApi:
    def test_generate_designs_for_all_pages(self, client):
        project, page1, page2 = _create_project_with_pages()
        ai = _build_mock_ai_service()

        with patch('controllers.project_controller.get_ai_service', return_value=ai), \
             patch('controllers.project_controller.task_manager.submit_task', side_effect=_mock_sync_submit_task), \
             patch('services.ai_service_manager.get_ai_service', return_value=ai):
            response = client.post(f'/api/projects/{project.id}/generate/designs', json={})

        data = assert_success_response(response, 202)
        assert data['data']['total_pages'] == 2

        db.session.expire_all()
        refreshed_page1 = Page.query.get(page1.id)
        refreshed_page2 = Page.query.get(page2.id)
        assert refreshed_page1.get_design_content()['text'] == '布局方式：封面描述'
        assert refreshed_page2.get_design_content()['text'] == '布局方式：内容页描述'

    def test_generate_designs_for_selected_pages_and_ignore_invalid_ids(self, client):
        project, page1, page2 = _create_project_with_pages()
        page2.set_design_content(None)
        db.session.commit()
        ai = _build_mock_ai_service()

        with patch('controllers.project_controller.get_ai_service', return_value=ai), \
             patch('controllers.project_controller.task_manager.submit_task', side_effect=_mock_sync_submit_task), \
             patch('services.ai_service_manager.get_ai_service', return_value=ai):
            response = client.post(
                f'/api/projects/{project.id}/generate/designs',
                json={'page_ids': [page2.id, 'missing-page-id']}
            )

        assert_success_response(response, 202)
        db.session.expire_all()
        assert Page.query.get(page1.id).get_design_content()['text'] == '旧设计 1'
        assert Page.query.get(page2.id).get_design_content()['text'] == '布局方式：内容页描述'

    def test_generate_designs_rejects_empty_page_ids(self, client):
        project, _, _ = _create_project_with_pages()

        response = client.post(
            f'/api/projects/{project.id}/generate/designs',
            json={'page_ids': []}
        )

        assert response.status_code == 400

    def test_generate_designs_rejects_all_invalid_page_ids(self, client):
        project, _, _ = _create_project_with_pages()

        response = client.post(
            f'/api/projects/{project.id}/generate/designs',
            json={'page_ids': ['missing-page-id']}
        )

        assert response.status_code == 400

    def test_generate_designs_marks_pages_without_description_as_failed(self, client):
        project, page1, page2 = _create_project_with_pages()
        page1.set_design_content(None)
        page2.set_description_content(None)
        page2.set_design_content(None)
        db.session.commit()
        ai = _build_mock_ai_service()

        with patch('controllers.project_controller.get_ai_service', return_value=ai), \
             patch('controllers.project_controller.task_manager.submit_task', side_effect=_mock_sync_submit_task), \
             patch('services.ai_service_manager.get_ai_service', return_value=ai):
            response = client.post(f'/api/projects/{project.id}/generate/designs', json={})

        data = assert_success_response(response, 202)
        task_id = data['data']['task_id']
        task = Task.query.get(task_id)
        progress = task.get_progress()

        assert progress['completed'] == 1
        assert progress['failed'] == 1
        assert Page.query.get(page2.id).get_design_content() is None


class TestDesignInvalidation:
    def test_description_change_clears_design(self, client):
        project, page1, _ = _create_project_with_pages()

        response = client.put(
            f'/api/projects/{project.id}/pages/{page1.id}/description',
            json={'description_content': {'text': '新的描述'}}
        )

        assert_success_response(response)
        db.session.expire_all()
        assert Page.query.get(page1.id).get_design_content() is None

    def test_style_change_clears_all_designs(self, client):
        project, page1, page2 = _create_project_with_pages()

        response = client.put(
            f'/api/projects/{project.id}',
            json={'template_style': 'new style'}
        )

        assert_success_response(response)
        db.session.expire_all()
        assert Page.query.get(page1.id).get_design_content() is None
        assert Page.query.get(page2.id).get_design_content() is None

    def test_outline_regeneration_clears_all_designs(self, client):
        project, page1, page2 = _create_project_with_pages(creation_type='outline')
        project.outline_text = '新的大纲文本'
        db.session.commit()
        ai = _build_mock_ai_service()

        with patch('controllers.project_controller.get_ai_service', return_value=ai):
            response = client.post(f'/api/projects/{project.id}/generate/outline', json={})

        assert_success_response(response)
        db.session.expire_all()
        assert Page.query.get(page1.id).get_design_content() is None
        assert Page.query.get(page2.id).get_design_content() is None
