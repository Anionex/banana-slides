"""
Settings controller tests for provider format handling.
"""

from unittest.mock import patch


def test_update_settings_accepts_lazyllm_provider(client, auth_headers):
    """`lazyllm` should be accepted as a valid provider format."""
    response = client.put('/api/settings',
                         headers=auth_headers,
                         json={'ai_provider_format': 'lazyllm'})

    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['data']['ai_provider_format'] == 'lazyllm'


def test_verify_uses_configured_text_model(client, auth_headers):
    """Verify endpoint should use configured text model, not a hardcoded gemini model."""
    # First set the text model to deepseek-chat
    client.put('/api/settings',
              headers=auth_headers,
              json={
                  'ai_provider_format': 'lazyllm',
                  'text_model': 'deepseek-chat'
              })

    # Mock the text provider to verify it's called with the right model
    from unittest.mock import MagicMock
    mock_provider = MagicMock()
    mock_provider.generate_text.return_value = 'OK'

    with patch('services.ai_providers.get_text_provider', return_value=mock_provider) as mock_get_provider:
        response = client.post('/api/settings/verify', headers=auth_headers)

    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['data']['available'] is True
    mock_get_provider.assert_called_once_with(model='deepseek-chat')
    mock_provider.generate_text.assert_called_once()
