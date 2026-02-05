"""
认证API单元测试 - SaaS版本
"""
import os
import pytest


# 测试期间跳过邮箱验证
os.environ['SKIP_EMAIL_VERIFICATION'] = 'true'


class TestAuthRegister:
    """用户注册测试"""

    def test_register_success(self, client):
        """测试正常注册"""
        response = client.post('/api/auth/register', json={
            'email': 'test@example.com',
            'password': 'password123',
            'username': 'testuser'
        })

        assert response.status_code == 201
        data = response.get_json()
        assert data['success'] is True
        assert 'user' in data['data']
        assert data['data']['user']['email'] == 'test@example.com'
        # dev mode returns tokens
        assert 'access_token' in data['data'] or 'require_verification' in data['data']

    def test_register_missing_email(self, client):
        """测试缺少邮箱"""
        response = client.post('/api/auth/register', json={
            'password': 'password123'
        })

        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False

    def test_register_missing_password(self, client):
        """测试缺少密码"""
        response = client.post('/api/auth/register', json={
            'email': 'test@example.com'
        })

        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False

    def test_register_empty_body(self, client):
        """测试空请求体"""
        response = client.post('/api/auth/register', json={})

        assert response.status_code == 400

    def test_register_duplicate_email(self, client):
        """测试重复邮箱注册"""
        # 先注册一个用户
        client.post('/api/auth/register', json={
            'email': 'duplicate@example.com',
            'password': 'password123'
        })

        # 再次用同一邮箱注册
        response = client.post('/api/auth/register', json={
            'email': 'duplicate@example.com',
            'password': 'password456'
        })

        assert response.status_code == 400


class TestAuthLogin:
    """用户登录测试"""

    def test_login_success(self, client):
        """测试正常登录"""
        # 先注册用户（dev mode下跳过验证）
        client.post('/api/auth/register', json={
            'email': 'login@example.com',
            'password': 'password123'
        })

        # 登录
        response = client.post('/api/auth/login', json={
            'email': 'login@example.com',
            'password': 'password123'
        })

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert 'access_token' in data['data']
        assert 'refresh_token' in data['data']
        assert data['data']['token_type'] == 'Bearer'

    def test_login_wrong_password(self, client):
        """测试密码错误"""
        # 先注册用户
        client.post('/api/auth/register', json={
            'email': 'wrongpwd@example.com',
            'password': 'password123'
        })

        # 用错误密码登录
        response = client.post('/api/auth/login', json={
            'email': 'wrongpwd@example.com',
            'password': 'wrongpassword'
        })

        assert response.status_code == 401
        data = response.get_json()
        assert data['success'] is False

    def test_login_nonexistent_user(self, client):
        """测试不存在的用户"""
        response = client.post('/api/auth/login', json={
            'email': 'nonexistent@example.com',
            'password': 'password123'
        })

        assert response.status_code == 401

    def test_login_empty_credentials(self, client):
        """测试空凭据"""
        response = client.post('/api/auth/login', json={
            'email': '',
            'password': ''
        })

        assert response.status_code == 400


class TestAuthMe:
    """获取当前用户信息测试"""

    def test_get_me_success(self, client):
        """测试获取当前用户信息"""
        # 注册并登录
        client.post('/api/auth/register', json={
            'email': 'me@example.com',
            'password': 'password123'
        })
        login_response = client.post('/api/auth/login', json={
            'email': 'me@example.com',
            'password': 'password123'
        })
        token = login_response.get_json()['data']['access_token']

        # 获取用户信息
        response = client.get('/api/auth/me', headers={
            'Authorization': f'Bearer {token}'
        })

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['user']['email'] == 'me@example.com'

    def test_get_me_no_token(self, client):
        """测试未提供token"""
        response = client.get('/api/auth/me')

        assert response.status_code == 401

    def test_get_me_invalid_token(self, client):
        """测试无效token"""
        response = client.get('/api/auth/me', headers={
            'Authorization': 'Bearer invalid_token_here'
        })

        assert response.status_code == 401


class TestAuthRefresh:
    """刷新token测试"""

    def test_refresh_token_success(self, client):
        """测试刷新token"""
        # 注册并登录
        client.post('/api/auth/register', json={
            'email': 'refresh@example.com',
            'password': 'password123'
        })
        login_response = client.post('/api/auth/login', json={
            'email': 'refresh@example.com',
            'password': 'password123'
        })
        refresh_token = login_response.get_json()['data']['refresh_token']

        # 刷新token
        response = client.post('/api/auth/refresh', json={
            'refresh_token': refresh_token
        })

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert 'access_token' in data['data']

    def test_refresh_token_invalid(self, client):
        """测试无效refresh token"""
        response = client.post('/api/auth/refresh', json={
            'refresh_token': 'invalid_refresh_token'
        })

        assert response.status_code == 401


class TestAuthPasswordChange:
    """密码修改测试"""

    def test_change_password_success(self, client):
        """测试修改密码成功"""
        # 注册并登录
        client.post('/api/auth/register', json={
            'email': 'changepwd@example.com',
            'password': 'oldpassword123'
        })
        login_response = client.post('/api/auth/login', json={
            'email': 'changepwd@example.com',
            'password': 'oldpassword123'
        })
        token = login_response.get_json()['data']['access_token']

        # 修改密码
        response = client.post('/api/auth/change-password',
            json={
                'current_password': 'oldpassword123',
                'new_password': 'newpassword456'
            },
            headers={'Authorization': f'Bearer {token}'}
        )

        assert response.status_code == 200

        # 验证新密码可以登录
        login_response = client.post('/api/auth/login', json={
            'email': 'changepwd@example.com',
            'password': 'newpassword456'
        })
        assert login_response.status_code == 200

    def test_change_password_wrong_current(self, client):
        """测试当前密码错误"""
        # 注册并登录
        client.post('/api/auth/register', json={
            'email': 'wrongcurrent@example.com',
            'password': 'password123'
        })
        login_response = client.post('/api/auth/login', json={
            'email': 'wrongcurrent@example.com',
            'password': 'password123'
        })
        token = login_response.get_json()['data']['access_token']

        # 用错误的当前密码修改
        response = client.post('/api/auth/change-password',
            json={
                'current_password': 'wrongpassword',
                'new_password': 'newpassword456'
            },
            headers={'Authorization': f'Bearer {token}'}
        )

        assert response.status_code == 400
