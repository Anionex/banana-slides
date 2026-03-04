"""
Unit tests for OIDC service
"""
import pytest
from unittest.mock import patch, MagicMock
from services.oidc_service import OIDCService


class TestOIDCService:
    """Test OIDC service with multiple providers"""

    @patch.dict('os.environ', {
        'OIDC_GOOGLE_CLIENT_ID': 'google-client-id',
        'OIDC_GOOGLE_CLIENT_SECRET': 'google-secret',
        'OIDC_REDIRECT_URI': 'http://localhost/callback'
    })
    def test_google_provider_initialization(self):
        """Test Google provider can be initialized"""
        service = OIDCService('google')
        assert service.provider == 'google'
        assert service.client_id == 'google-client-id'
        assert service.client_secret == 'google-secret'

    def test_unsupported_provider_raises_error(self):
        """Test unsupported provider raises ValueError"""
        with pytest.raises(ValueError, match="Unsupported provider"):
            OIDCService('unsupported')

    @patch.dict('os.environ', {
        'OIDC_GOOGLE_CLIENT_ID': 'google-client-id',
        'OIDC_GOOGLE_CLIENT_SECRET': 'google-secret',
        'OIDC_REDIRECT_URI': 'http://localhost/callback'
    })
    def test_missing_config_raises_error(self):
        """Test missing configuration raises ValueError"""
        with patch.dict('os.environ', {'OIDC_GOOGLE_CLIENT_ID': ''}, clear=False):
            with pytest.raises(ValueError, match="Missing OIDC configuration"):
                OIDCService('google')

    @patch.dict('os.environ', {
        'OIDC_GOOGLE_CLIENT_ID': 'test-id',
        'OIDC_GOOGLE_CLIENT_SECRET': 'test-secret',
        'OIDC_REDIRECT_URI': 'http://localhost/callback'
    })
    @patch('services.oidc_service.OAuth2Session')
    def test_get_authorization_url(self, mock_session_class):
        """Test authorization URL generation"""
        mock_session = MagicMock()
        mock_session.create_authorization_url.return_value = ('http://auth-url', 'state')
        mock_session_class.return_value = mock_session

        service = OIDCService('google')
        url = service.get_authorization_url('test-state')

        assert url == 'http://auth-url'
        mock_session.create_authorization_url.assert_called_once()

    @patch.dict('os.environ', {
        'OIDC_GOOGLE_CLIENT_ID': 'test-id',
        'OIDC_GOOGLE_CLIENT_SECRET': 'test-secret',
        'OIDC_REDIRECT_URI': 'http://localhost/callback'
    })
    @patch('services.oidc_service.OAuth2Session')
    def test_exchange_code(self, mock_session_class):
        """Test code exchange for tokens"""
        mock_session = MagicMock()
        mock_session.fetch_token.return_value = {'access_token': 'token123'}
        mock_session_class.return_value = mock_session

        service = OIDCService('google')
        token = service.exchange_code('auth-code')

        assert token == {'access_token': 'token123'}
        mock_session.fetch_token.assert_called_once()

    @patch.dict('os.environ', {
        'OIDC_GOOGLE_CLIENT_ID': 'test-id',
        'OIDC_GOOGLE_CLIENT_SECRET': 'test-secret',
        'OIDC_REDIRECT_URI': 'http://localhost/callback'
    })
    @patch('services.oidc_service.OAuth2Session')
    def test_get_user_info_success(self, mock_session_class):
        """Test successful user info retrieval"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'sub': '123', 'email': 'test@example.com'}

        mock_session = MagicMock()
        mock_session.get.return_value = mock_response
        mock_session_class.return_value = mock_session

        service = OIDCService('google')
        user_info = service.get_user_info('access-token')

        assert user_info == {'sub': '123', 'email': 'test@example.com'}

    @patch.dict('os.environ', {
        'OIDC_GOOGLE_CLIENT_ID': 'test-id',
        'OIDC_GOOGLE_CLIENT_SECRET': 'test-secret',
        'OIDC_REDIRECT_URI': 'http://localhost/callback'
    })
    @patch('services.oidc_service.OAuth2Session')
    def test_get_user_info_failure(self, mock_session_class):
        """Test user info retrieval failure"""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = 'Unauthorized'

        mock_session = MagicMock()
        mock_session.get.return_value = mock_response
        mock_session_class.return_value = mock_session

        service = OIDCService('google')
        user_info = service.get_user_info('invalid-token')

        assert user_info is None
