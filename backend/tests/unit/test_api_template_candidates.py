"""
Template candidate API tests for issue #406 MVP.
"""
import pytest
from conftest import assert_success_response, assert_error_response


@pytest.mark.unit
class TestTemplateCandidates:
    def test_create_template_candidates_project_not_found(self, client):
        response = client.post(
            '/api/projects/non-existent-project/template-candidates',
            json={'style_prompt': 'minimal business blue white'}
        )

        data = assert_error_response(response, 404)
        assert data['error']['message'] == 'Project not found'
        assert data['error']['code'] == 'PROJECT_NOT_FOUND'

    def test_create_template_candidates_requires_style_prompt(self, sample_project, client):
        project_id = sample_project['project_id']

        response = client.post(
            f'/api/projects/{project_id}/template-candidates',
            json={'style_prompt': '   '}
        )

        data = assert_error_response(response, 400)
        assert data['error']['message'] == 'style_prompt is required'
        assert data['error']['code'] == 'INVALID_REQUEST'

    def test_create_template_candidates_success(self, sample_project, client):
        project_id = sample_project['project_id']

        response = client.post(
            f'/api/projects/{project_id}/template-candidates',
            json={
                'style_prompt': 'minimal business blue white',
                'aspect_ratio': '16:9',
            }
        )

        data = assert_success_response(response, 200)
        payload = data['data']

        assert payload['status'] == 'COMPLETED'
        assert payload['task_id'] is None
        assert 'slide template/style candidate' in payload['prompt']
        assert 'project\'s template image' in payload['prompt']
        assert 'existing project template upload flow' in payload['usage']
        assert 'No separate candidate/reference path is added' in payload['usage']
        assert len(payload['candidates']) == 5

        for index, candidate in enumerate(payload['candidates'], start=1):
            assert candidate['candidate_id'] == f'{project_id}-candidate-{index}'
            assert candidate['image_url'].startswith('data:image/png;base64,')
