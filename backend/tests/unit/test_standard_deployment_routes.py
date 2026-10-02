"""The open-source app must not register official website services."""

import pytest


@pytest.mark.parametrize(('method', 'path'), [
    ('get', '/api/public-config'),
    ('post', '/api/feedback'),
    ('post', '/api/waitlist'),
    ('post', '/api/admin/history'),
    ('post', '/api/admin/feedback'),
    ('post', '/api/admin/waitlist/export'),
])
def test_official_website_endpoints_are_absent(client, method, path):
    response = getattr(client, method)(path)
    assert response.status_code == 404


def test_standard_history_and_settings_are_available(client):
    assert client.get('/api/projects').status_code == 200
    response = client.get('/api/settings')
    assert response.status_code == 200
    assert 'image_quality' in response.get_json()['data']
