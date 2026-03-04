"""
OIDC authentication service
"""
import os
import logging
from authlib.integrations.requests_client import OAuth2Session
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class OIDCService:
    """OIDC provider integration"""

    PROVIDERS = {
        'google': {
            'authorize_url': 'https://accounts.google.com/o/oauth2/v2/auth',
            'token_url': 'https://oauth2.googleapis.com/token',
            'userinfo_url': 'https://openidconnect.googleapis.com/v1/userinfo',
            'scope': 'openid email profile'
        }
    }

    def __init__(self, provider: str):
        if provider not in self.PROVIDERS:
            raise ValueError(f"Unsupported provider: {provider}")

        self.provider = provider
        self.config = self.PROVIDERS[provider]
        self.client_id = os.getenv(f'OIDC_{provider.upper()}_CLIENT_ID')
        self.client_secret = os.getenv(f'OIDC_{provider.upper()}_CLIENT_SECRET')
        self.redirect_uri = os.getenv('OIDC_REDIRECT_URI')

        if not all([self.client_id, self.client_secret, self.redirect_uri]):
            raise ValueError(f"Missing OIDC configuration for {provider}")

    def get_authorization_url(self, state: str) -> str:
        """Generate authorization URL"""
        session = OAuth2Session(
            self.client_id,
            redirect_uri=self.redirect_uri,
            scope=self.config['scope']
        )
        url, _ = session.create_authorization_url(
            self.config['authorize_url'],
            state=state
        )
        return url

    def exchange_code(self, code: str) -> Dict:
        """Exchange authorization code for tokens"""
        session = OAuth2Session(
            self.client_id,
            redirect_uri=self.redirect_uri
        )
        token = session.fetch_token(
            self.config['token_url'],
            code=code,
            client_secret=self.client_secret,
            timeout=10
        )
        return token

    def get_user_info(self, access_token: str) -> Optional[Dict]:
        """Get user info from provider"""
        try:
            session = OAuth2Session(self.client_id, token={'access_token': access_token})
            resp = session.get(self.config['userinfo_url'], timeout=10)
            if resp.status_code == 200:
                return resp.json()
            logger.error(f"Failed to get user info: status={resp.status_code}, body={resp.text}")
            return None
        except Exception as e:
            logger.error(f"Error getting user info: {e}", exc_info=True)
            return None
