"""
Auth middleware unit tests
"""
import pytest
from unittest.mock import MagicMock, patch


class TestAuthRequired:
    """@auth_required 装饰器测试"""

    def test_no_auth_header(self, client):
        """无认证头应返回401"""
        response = client.get('/api/projects')
        assert response.status_code == 401

    def test_empty_bearer_token(self, client):
        """空Bearer token应返回401"""
        response = client.get('/api/projects', headers={
            'Authorization': 'Bearer '
        })
        assert response.status_code == 401

    def test_invalid_token(self, client):
        """无效token应返回401"""
        response = client.get('/api/projects', headers={
            'Authorization': 'Bearer invalid_token_here'
        })
        assert response.status_code == 401

    def test_valid_token(self, client, auth_headers):
        """有效token应允许访问"""
        response = client.get('/api/projects', headers=auth_headers)
        assert response.status_code == 200

    def test_raw_token_without_bearer(self, client):
        """不带Bearer前缀的token也应被处理"""
        # Register and get token
        client.post('/api/auth/register', json={
            'email': 'rawtoken@example.com',
            'password': 'password123'
        })
        login_resp = client.post('/api/auth/login', json={
            'email': 'rawtoken@example.com',
            'password': 'password123'
        })
        token = login_resp.get_json()['data']['access_token']
        # Send without Bearer prefix
        response = client.get('/api/projects', headers={
            'Authorization': token
        })
        assert response.status_code == 200

    def test_inactive_user_rejected(self, client):
        """被禁用的用户应返回403"""
        reg_resp = client.post('/api/auth/register', json={
            'email': 'disabled@example.com',
            'password': 'password123'
        })
        token = reg_resp.get_json()['data']['access_token']

        # Disable user
        from models import db, User
        with client.application.app_context():
            user = User.query.filter_by(email='disabled@example.com').first()
            user.is_active = False
            db.session.commit()

        response = client.get('/api/projects', headers={
            'Authorization': f'Bearer {token}'
        })
        assert response.status_code == 403


class TestGetCurrentUser:
    """get_current_user 测试"""

    def test_returns_none_without_context(self, app):
        from middlewares.auth import get_current_user
        with app.test_request_context():
            assert get_current_user() is None

    def test_returns_user_from_g(self, app):
        from middlewares.auth import get_current_user
        from flask import g
        with app.test_request_context():
            mock_user = MagicMock()
            g.current_user = mock_user
            assert get_current_user() is mock_user


class TestAdminRequired:
    """@admin_required 装饰器测试"""

    def test_non_admin_rejected(self, client, auth_headers):
        """普通用户应被拒绝访问管理端点"""
        response = client.post('/api/settings/reset', headers=auth_headers)
        assert response.status_code == 403

    def test_admin_allowed(self, client):
        """管理员应被允许访问"""
        reg_resp = client.post('/api/auth/register', json={
            'email': 'admin@example.com',
            'password': 'password123'
        })
        token = reg_resp.get_json()['data']['access_token']

        # Make user admin
        from models import db, User
        with client.application.app_context():
            user = User.query.filter_by(email='admin@example.com').first()
            user.is_admin = True
            db.session.commit()

        response = client.post('/api/settings/reset', headers={
            'Authorization': f'Bearer {token}'
        })
        # Should not be 403 (may fail for other reasons, but auth should pass)
        assert response.status_code != 403
