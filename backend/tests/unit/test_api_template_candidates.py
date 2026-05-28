"""
Template candidate API tests for the maintainer-requested text-style flow.
"""

from conftest import assert_error_response, assert_success_response


class TestTemplateCandidates:
    def test_create_template_candidates_ok(self, client):
        response = client.post(
            '/api/template-candidates',
            json={'style_prompt': 'minimal business blue white', 'count': 5, 'aspect_ratio': '16:9'}
        )

        data = assert_success_response(response)
        payload = data['data']
        assert payload['status'] == 'COMPLETED'
        assert len(payload['candidates']) == 5
        assert payload['candidates'][0]['candidate_id'] == 'candidate-1'
        assert payload['candidates'][0]['image_url'].startswith('data:image/png;base64,')
        assert 'template/style references' in payload['usage']

    def test_create_template_candidates_requires_style_prompt(self, client):
        response = client.post('/api/template-candidates', json={'count': 5})
        data = assert_error_response(response, 400)
        assert 'style_prompt is required' in data['error']['message']
