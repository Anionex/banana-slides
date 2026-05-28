"""
Template candidate API tests for the text-style creation flow.
"""

import time
from unittest.mock import patch

from conftest import assert_error_response, assert_success_response


class TestTemplateCandidates:
    @patch('controllers.template_controller.task_manager.submit_task')
    def test_create_template_candidates_starts_async_task(self, submit_task, client):
        response = client.post(
            '/api/template-candidates',
            json={'style_prompt': 'minimal business blue white', 'count': 5, 'aspect_ratio': '16:9'}
        )

        data = assert_success_response(response, 202)
        payload = data['data']
        assert payload['status'] == 'PENDING'
        assert payload['task_id']
        assert payload['candidates'] == []
        assert payload['progress']['total'] == 5
        assert 'template/style references' in payload['usage']
        submit_task.assert_called_once()

    def test_get_template_candidates_returns_completed_candidates(self, client, app):
        from models import db, Task

        with app.app_context():
            task = Task(project_id=None, task_type='GENERATE_TEMPLATE_CANDIDATES', status='COMPLETED')
            task.set_progress({
                'total': 1,
                'completed': 1,
                'failed': 0,
                'prompt': 'Generate slide template/style candidates',
                'usage': 'These candidates are transient slide template/style references.',
                'candidates': [{
                    'candidate_id': 'candidate-1',
                    'image_url': '/files/template-candidates/task-id/candidate-1.png',
                    'thumb_url': '/files/template-candidates/task-id/candidate-1.png',
                    'transient': True,
                }],
            })
            db.session.add(task)
            db.session.commit()
            task_id = task.id

        response = client.get(f'/api/template-candidates/{task_id}')

        data = assert_success_response(response)
        payload = data['data']
        assert payload['status'] == 'COMPLETED'
        assert payload['task_id'] == task_id
        assert payload['candidates'][0]['candidate_id'] == 'candidate-1'
        assert payload['candidates'][0]['image_url'].startswith('/files/template-candidates/')

    def test_create_template_candidates_requires_style_prompt(self, client):
        response = client.post('/api/template-candidates', json={'count': 5})
        data = assert_error_response(response, 400)
        assert 'style_prompt is required' in data['error']['message']

    def test_template_candidate_task_generates_candidates_concurrently(self, app):
        from PIL import Image
        from models import db, Task
        from services.task_manager import generate_template_candidates_task

        class SlowImageService:
            def __init__(self):
                self.started_at = []

            def generate_image(self, **kwargs):
                self.started_at.append(time.monotonic())
                time.sleep(0.2)
                return Image.new('RGB', (100, 56), color='blue')

        service = SlowImageService()
        with app.app_context():
            task = Task(project_id=None, task_type='GENERATE_TEMPLATE_CANDIDATES', status='PENDING')
            task.set_progress({'total': 3, 'completed': 0, 'failed': 0, 'candidates': []})
            db.session.add(task)
            db.session.commit()
            task_id = task.id

        start = time.monotonic()
        generate_template_candidates_task(
            task_id=task_id,
            style_prompt='minimal business blue white',
            prompt='Generate slide template/style candidates',
            usage='These candidates are transient slide template/style references.',
            count=3,
            aspect_ratio='16:9',
            resolution='2K',
            ai_service=service,
            upload_folder=app.config['UPLOAD_FOLDER'],
            app=app,
            use_mock=False,
        )
        elapsed = time.monotonic() - start

        with app.app_context():
            task = Task.query.get(task_id)
            progress = task.get_progress()

        assert task.status == 'COMPLETED'
        assert progress['completed'] == 3
        assert [c['candidate_id'] for c in progress['candidates']] == [
            'candidate-1',
            'candidate-2',
            'candidate-3',
        ]
        assert elapsed < 0.5
        assert max(service.started_at) - min(service.started_at) < 0.15
