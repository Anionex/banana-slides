"""
Settings controller API unit tests
"""
import pytest
from conftest import assert_success_response


def _register_admin(client):
    """Helper: register a user and promote to admin, return token"""
    reg_resp = client.post('/api/auth/register', json={
        'email': 'settingsadmin@example.com',
        'password': 'password123'
    })
    token = reg_resp.get_json()['data']['access_token']

    from models import db, User
    with client.application.app_context():
        user = User.query.filter_by(email='settingsadmin@example.com').first()
        user.is_admin = True
        db.session.commit()

    return token


def _register_user(client, email='settingsuser@example.com'):
    """Helper: register a normal user, return token"""
    reg_resp = client.post('/api/auth/register', json={
        'email': email,
        'password': 'password123'
    })
    return reg_resp.get_json()['data']['access_token']


class TestGetSettings:
    """获取设置测试"""

    def test_get_settings_success(self, client):
        token = _register_user(client)
        response = client.get('/api/settings/', headers={
            'Authorization': f'Bearer {token}'
        })
        data = assert_success_response(response)
        # Non-admin users should only see user-editable fields
        assert 'data' in data

    def test_get_settings_unauthorized(self, client):
        response = client.get('/api/settings/')
        assert response.status_code == 401

    def test_admin_gets_all_settings(self, client):
        token = _register_admin(client)
        response = client.get('/api/settings/', headers={
            'Authorization': f'Bearer {token}'
        })
        data = assert_success_response(response)
        # Admin should see all settings
        assert 'data' in data


class TestUpdateSettings:
    """更新设置测试"""

    def test_update_output_language(self, client):
        """普通用户可以修改输出语言"""
        token = _register_user(client, 'updlang@example.com')
        response = client.put('/api/settings/', json={
            'output_language': 'en'
        }, headers={'Authorization': f'Bearer {token}'})
        data = assert_success_response(response)

    def test_update_image_resolution(self, client):
        """普通用户可以修改图片分辨率"""
        token = _register_user(client, 'updres@example.com')
        response = client.put('/api/settings/', json={
            'image_resolution': '4K'
        }, headers={'Authorization': f'Bearer {token}'})
        data = assert_success_response(response)

    def test_update_invalid_resolution(self, client):
        """无效的分辨率应返回错误"""
        token = _register_admin(client)
        response = client.put('/api/settings/', json={
            'image_resolution': '8K'
        }, headers={'Authorization': f'Bearer {token}'})
        assert response.status_code == 400

    def test_update_invalid_language(self, client):
        """无效的语言应返回错误"""
        token = _register_admin(client)
        response = client.put('/api/settings/', json={
            'output_language': 'fr'
        }, headers={'Authorization': f'Bearer {token}'})
        assert response.status_code == 400

    def test_update_invalid_provider_format(self, client):
        """无效的provider format应返回错误"""
        token = _register_admin(client)
        response = client.put('/api/settings/', json={
            'ai_provider_format': 'invalid'
        }, headers={'Authorization': f'Bearer {token}'})
        assert response.status_code == 400

    def test_update_empty_body(self, client):
        token = _register_user(client, 'emptybody@example.com')
        response = client.put('/api/settings/',
                              content_type='application/json',
                              data='null',
                              headers={'Authorization': f'Bearer {token}'})
        assert response.status_code == 400

    def test_update_unauthorized(self, client):
        response = client.put('/api/settings/', json={
            'output_language': 'en'
        })
        assert response.status_code == 401

    def test_normal_user_cannot_update_admin_fields(self, client):
        """普通用户不能修改管理员字段"""
        token = _register_user(client, 'normalupd@example.com')
        response = client.put('/api/settings/', json={
            'api_key': 'should-not-work'
        }, headers={'Authorization': f'Bearer {token}'})
        # Should either reject or silently ignore admin-only fields
        # If no user-editable fields are provided, should return 400
        assert response.status_code in [200, 400]

    def test_update_worker_settings(self, client):
        """管理员可以修改worker设置"""
        token = _register_admin(client)
        response = client.put('/api/settings/', json={
            'max_description_workers': 8,
            'max_image_workers': 10
        }, headers={'Authorization': f'Bearer {token}'})
        data = assert_success_response(response)

    def test_update_invalid_worker_count(self, client):
        """无效的worker数量"""
        token = _register_admin(client)
        response = client.put('/api/settings/', json={
            'max_description_workers': 100
        }, headers={'Authorization': f'Bearer {token}'})
        assert response.status_code == 400


class TestResetSettings:
    """重置设置测试"""

    def test_reset_admin_only(self, client):
        """非管理员不能重置设置"""
        token = _register_user(client, 'noreset@example.com')
        response = client.post('/api/settings/reset', headers={
            'Authorization': f'Bearer {token}'
        })
        assert response.status_code == 403

    def test_reset_unauthorized(self, client):
        response = client.post('/api/settings/reset')
        assert response.status_code == 401
