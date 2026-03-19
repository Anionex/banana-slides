"""
Settings controller API unit tests
"""
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

    def test_non_admin_gets_effective_values_with_global_fallback(self, client):
        admin_token = _register_admin(client)

        client.put('/api/admin/config/', json={
            'user_editable_fields': ['text_model', 'image_resolution']
        }, headers={'Authorization': f'Bearer {admin_token}'})

        from models import db, Settings, User, UserSettings
        with client.application.app_context():
            global_settings = Settings.get_settings()
            global_settings.text_model = 'stale-global-text-model'
            global_settings.image_resolution = '4K'

            admin_user = User.query.filter_by(email='settingsadmin@example.com').first()
            admin_settings = UserSettings.get_or_create_for_user(admin_user.id)
            admin_settings.text_model = 'admin-text-model'
            admin_settings.image_resolution = '2K'
            db.session.commit()

        user_token = _register_user(client, 'effective-values@example.com')

        with client.application.app_context():
            user = User.query.filter_by(email='effective-values@example.com').first()
            user_settings = UserSettings.get_or_create_for_user(user.id)
            user_settings.text_model = None
            db.session.commit()

        response = client.get('/api/settings/', headers={
            'Authorization': f'Bearer {user_token}'
        })
        data = assert_success_response(response)

        assert data['data']['text_model'] == 'admin-text-model'
        assert data['data']['image_resolution'] == '2K'
        assert data['data']['_value_sources']['text_model'] == 'global'
        assert data['data']['_value_sources']['image_resolution'] == 'user'
        assert 'text_model' in data['data']['_inherits_global_fields']

    def test_non_admin_does_not_receive_inherited_global_sensitive_values(self, client):
        admin_token = _register_admin(client)

        client.put('/api/admin/config/', json={
            'user_editable_fields': ['api_key']
        }, headers={'Authorization': f'Bearer {admin_token}'})

        from models import db, Settings, User, UserSettings
        with client.application.app_context():
            global_settings = Settings.get_settings()
            global_settings.api_key = 'stale-global-secret-key'

            admin_user = User.query.filter_by(email='settingsadmin@example.com').first()
            admin_settings = UserSettings.get_or_create_for_user(admin_user.id)
            admin_settings.api_key = 'admin-secret-key'
            db.session.commit()

        user_token = _register_user(client, 'sensitive-fallback@example.com')

        with client.application.app_context():
            user = User.query.filter_by(email='sensitive-fallback@example.com').first()
            user_settings = UserSettings.get_or_create_for_user(user.id)
            user_settings.api_key = None
            db.session.commit()

        response = client.get('/api/settings/', headers={
            'Authorization': f'Bearer {user_token}'
        })
        data = assert_success_response(response)

        assert data['data']['api_key'] is None
        assert data['data']['_value_sources']['api_key'] == 'global'
        assert 'api_key' in data['data']['_inherits_global_fields']


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

    def test_new_user_settings_inherit_admin_defaults_before_global_settings(self, client):
        """新建用户应优先继承管理员当前默认配置，而不是落到旧全局 Settings。"""
        admin_token = _register_admin(client)

        from models import db, Settings, User, UserSettings
        with client.application.app_context():
            global_settings = Settings.get_settings()
            global_settings.ai_provider_format = 'gemini'
            global_settings.api_base_url = 'https://global.example.test/gemini'
            global_settings.api_key = 'global-key'
            global_settings.text_model = 'global-text-model'
            global_settings.image_model = 'global-image-model'
            db.session.commit()

            admin_user = User.query.filter_by(email='settingsadmin@example.com').first()
            admin_settings = UserSettings.get_or_create_for_user(admin_user.id)
            admin_settings.ai_provider_format = 'openai'
            admin_settings.api_base_url = 'https://admin.example.test/v1'
            admin_settings.api_key = 'admin-key'
            admin_settings.text_model = 'admin-text-model'
            admin_settings.image_model = 'admin-image-model'
            db.session.commit()

        response = client.put('/api/settings/', json={
            'text_model': 'admin-text-model'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        assert response.status_code == 200

        _register_user(client, 'inherits-admin-default@example.com')

        with client.application.app_context():
            user = User.query.filter_by(email='inherits-admin-default@example.com').first()
            settings = UserSettings.get_or_create_for_user(user.id)
            assert settings.ai_provider_format == 'openai'
            assert settings.api_base_url == 'https://admin.example.test/v1'
            assert settings.api_key == 'admin-key'
            assert settings.text_model == 'admin-text-model'
            assert settings.image_model == 'admin-image-model'

    def test_non_admin_update_response_uses_effective_values(self, client):
        admin_token = _register_admin(client)
        client.put('/api/admin/config/', json={
            'user_editable_fields': ['text_model']
        }, headers={'Authorization': f'Bearer {admin_token}'})

        from models import db, Settings
        with client.application.app_context():
            global_settings = Settings.get_settings()
            global_settings.text_model = 'global-text-model'
            db.session.commit()

        user_token = _register_user(client, 'update-effective@example.com')
        response = client.put('/api/settings/', json={
            'text_model': None
        }, headers={'Authorization': f'Bearer {user_token}'})
        data = assert_success_response(response)

        assert data['data']['text_model'] == 'global-text-model'
        assert data['data']['_value_sources']['text_model'] == 'global'


class TestResetSettings:
    """重置设置测试"""

    def test_admin_reset_restores_env_defaults_and_updates_global_settings(self, client):
        admin_token = _register_admin(client)

        from models import Settings, User, UserSettings
        from config import Config

        with client.application.app_context():
            admin_user = User.query.filter_by(email='settingsadmin@example.com').first()
            admin_settings = UserSettings.get_or_create_for_user(admin_user.id)
            admin_settings.ai_provider_format = 'openai'
            admin_settings.api_base_url = 'https://admin.example.test/v1'
            admin_settings.api_key = 'admin-key'
            admin_settings.text_model = 'admin-text-model'
            settings = Settings.get_settings()
            settings.ai_provider_format = 'openai'
            settings.api_base_url = 'https://stale-global.example.test/v1'
            settings.api_key = 'stale-global-key'
            settings.text_model = 'stale-global-text-model'

        response = client.post('/api/settings/reset', headers={
            'Authorization': f'Bearer {admin_token}'
        })
        data = assert_success_response(response)

        with client.application.app_context():
            admin_user = User.query.filter_by(email='settingsadmin@example.com').first()
            admin_settings = UserSettings.get_or_create_for_user(admin_user.id)
            settings = Settings.get_settings()

            assert admin_settings.ai_provider_format == Config.AI_PROVIDER_FORMAT
            assert settings.ai_provider_format == Config.AI_PROVIDER_FORMAT
            assert admin_settings.api_base_url == settings.api_base_url
            assert admin_settings.api_key == settings.api_key
            assert admin_settings.text_model == settings.text_model
            assert data['data']['ai_provider_format'] == Config.AI_PROVIDER_FORMAT

    def test_non_admin_reset_restores_admin_defaults(self, client):
        """普通用户重置后应回到管理员配置，而不是保留隐藏旧覆盖"""
        admin_token = _register_admin(client)

        client.put('/api/admin/config/', json={
            'user_editable_fields': ['api_key', 'api_base_url', 'text_model']
        }, headers={'Authorization': f'Bearer {admin_token}'})

        from models import db, Settings, User, UserSettings
        with client.application.app_context():
            global_settings = Settings.get_settings()
            global_settings.ai_provider_format = 'gemini'
            global_settings.api_base_url = 'https://global.example.test/gemini'
            global_settings.api_key = 'global-secret-key'
            global_settings.text_model = 'global-text-model'
            db.session.commit()

            admin_user = User.query.filter_by(email='settingsadmin@example.com').first()
            admin_settings = UserSettings.get_or_create_for_user(admin_user.id)
            admin_settings.ai_provider_format = 'openai'
            admin_settings.api_base_url = 'https://admin.example.test/v1'
            admin_settings.api_key = 'admin-secret-key'
            admin_settings.text_model = 'admin-text-model'
            db.session.commit()

        token = _register_user(client, 'reset-user@example.com')

        with client.application.app_context():
            user = User.query.filter_by(email='reset-user@example.com').first()
            settings = UserSettings.get_or_create_for_user(user.id)
            settings.ai_provider_format = 'openai'
            settings.api_base_url = 'https://user.example.test/v1'
            settings.api_key = 'user-secret-key'
            settings.text_model = 'user-text-model'
            db.session.commit()

        response = client.post('/api/settings/reset', headers={
            'Authorization': f'Bearer {token}'
        })
        data = assert_success_response(response)

        assert data['data']['api_key'] is None
        assert data['data']['_value_sources']['api_key'] == 'global'
        assert data['data']['api_base_url'] == 'https://admin.example.test/v1'
        assert data['data']['text_model'] == 'admin-text-model'

        with client.application.app_context():
            user = User.query.filter_by(email='reset-user@example.com').first()
            settings = UserSettings.get_or_create_for_user(user.id)
            assert settings.ai_provider_format == 'openai'
            assert settings.api_base_url is None
            assert settings.api_key is None
            assert settings.text_model is None

    def test_non_admin_reset_does_not_change_global_or_other_user_settings(self, client):
        admin_token = _register_admin(client)
        client.put('/api/admin/config/', json={
            'user_editable_fields': ['api_key', 'api_base_url', 'text_model']
        }, headers={'Authorization': f'Bearer {admin_token}'})

        from models import db, Settings, User, UserSettings
        with client.application.app_context():
            settings = Settings.get_settings()
            settings.ai_provider_format = 'gemini'
            settings.api_base_url = 'https://global.example.test/gemini'
            settings.api_key = 'global-key'
            settings.text_model = 'global-text-model'
            db.session.commit()

            admin_user = User.query.filter_by(email='settingsadmin@example.com').first()
            admin_settings = UserSettings.get_or_create_for_user(admin_user.id)
            admin_settings.ai_provider_format = 'openai'
            admin_settings.api_base_url = 'https://admin.example.test/v1'
            admin_settings.api_key = 'admin-key'
            admin_settings.text_model = 'admin-text-model'
            db.session.commit()

        token_a = _register_user(client, 'reset-a@example.com')
        token_b = _register_user(client, 'reset-b@example.com')

        with client.application.app_context():
            user_a = User.query.filter_by(email='reset-a@example.com').first()
            user_b = User.query.filter_by(email='reset-b@example.com').first()
            settings_a = UserSettings.get_or_create_for_user(user_a.id)
            settings_b = UserSettings.get_or_create_for_user(user_b.id)
            settings_a.api_base_url = 'https://user-a.example.test/v1'
            settings_a.api_key = 'user-a-key'
            settings_a.text_model = 'user-a-text-model'
            settings_b.api_base_url = 'https://user-b.example.test/v1'
            settings_b.api_key = 'user-b-key'
            settings_b.text_model = 'user-b-text-model'
            db.session.commit()

        response = client.post('/api/settings/reset', headers={
            'Authorization': f'Bearer {token_a}'
        })
        assert response.status_code == 200

        with client.application.app_context():
            settings = Settings.get_settings()
            user_a = User.query.filter_by(email='reset-a@example.com').first()
            user_b = User.query.filter_by(email='reset-b@example.com').first()
            settings_a = UserSettings.get_or_create_for_user(user_a.id)
            settings_b = UserSettings.get_or_create_for_user(user_b.id)

            assert settings.api_base_url == 'https://global.example.test/gemini'
            assert settings.api_key == 'global-key'
            assert settings.text_model == 'global-text-model'
            assert settings_a.api_base_url is None
            assert settings_a.api_key is None
            assert settings_a.text_model is None
            assert settings_b.api_base_url == 'https://user-b.example.test/v1'
            assert settings_b.api_key == 'user-b-key'
            assert settings_b.text_model == 'user-b-text-model'

    def test_reset_unauthorized(self, client):
        response = client.post('/api/settings/reset')
        assert response.status_code == 401
