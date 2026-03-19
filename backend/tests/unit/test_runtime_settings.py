"""
Runtime settings arbitration unit tests.
"""


def test_default_settings_source_prefers_admin_user_settings(app):
    from models import db, Settings, User, UserSettings
    from services.runtime_settings import get_default_settings_source

    with app.app_context():
        settings = Settings.get_settings()
        settings.ai_provider_format = 'gemini'
        settings.api_base_url = 'https://global.example.test/gemini'
        settings.api_key = 'global-key'
        settings.text_model = 'global-text-model'

        admin = User(
            email='runtime-admin@example.com',
            username='runtime-admin',
            password_hash='hash',
            is_admin=True,
            email_verified=True,
        )
        db.session.add(admin)
        db.session.commit()

        admin_settings = UserSettings.get_or_create_for_user(admin.id)
        admin_settings.ai_provider_format = 'openai'
        admin_settings.api_base_url = 'https://admin.example.test/v1'
        admin_settings.api_key = 'admin-key'
        admin_settings.text_model = 'admin-text-model'
        db.session.commit()

        default_source = get_default_settings_source()

        assert default_source.user_id == admin.id
        assert default_source.ai_provider_format == 'openai'
        assert default_source.api_base_url == 'https://admin.example.test/v1'
        assert default_source.api_key == 'admin-key'
        assert default_source.text_model == 'admin-text-model'


def test_effective_settings_override_prefers_user_and_falls_back_to_admin_defaults(app):
    from models import db, Settings, User, UserSettings
    from services.runtime_settings import build_effective_settings_override

    with app.app_context():
        settings = Settings.get_settings()
        settings.ai_provider_format = 'gemini'
        settings.api_base_url = 'https://global.example.test/gemini'
        settings.api_key = 'global-key'
        settings.text_model = 'global-text-model'
        settings.image_model = 'global-image-model'

        admin = User(
            email='runtime-admin-2@example.com',
            username='runtime-admin-2',
            password_hash='hash',
            is_admin=True,
            email_verified=True,
        )
        user = User(
            email='runtime-user@example.com',
            username='runtime-user',
            password_hash='hash',
            is_admin=False,
            email_verified=True,
        )
        db.session.add(admin)
        db.session.add(user)
        db.session.commit()

        admin_settings = UserSettings.get_or_create_for_user(admin.id)
        admin_settings.ai_provider_format = 'openai'
        admin_settings.api_base_url = 'https://admin.example.test/v1'
        admin_settings.api_key = 'admin-key'
        admin_settings.text_model = 'admin-text-model'
        admin_settings.image_model = 'admin-image-model'

        user_settings = UserSettings.get_or_create_for_user(user.id)
        user_settings.api_base_url = None
        user_settings.api_key = None
        user_settings.text_model = None
        user_settings.image_model = 'user-image-model'
        db.session.commit()

        override = build_effective_settings_override(user.id)

        assert override['AI_PROVIDER_FORMAT'] == 'openai'
        assert override['GOOGLE_API_BASE'] == 'https://admin.example.test/v1'
        assert override['GOOGLE_API_KEY'] == 'admin-key'
        assert override['TEXT_MODEL'] == 'admin-text-model'
        assert override['IMAGE_MODEL'] == 'user-image-model'


def test_effective_settings_payload_uses_admin_defaults_for_nullable_fields(app):
    from models import db, User, UserSettings
    from services.runtime_settings import build_effective_settings_payload

    with app.app_context():
        admin = User(
            email='runtime-admin-3@example.com',
            username='runtime-admin-3',
            password_hash='hash',
            is_admin=True,
            email_verified=True,
        )
        user = User(
            email='runtime-user-2@example.com',
            username='runtime-user-2',
            password_hash='hash',
            is_admin=False,
            email_verified=True,
        )
        db.session.add(admin)
        db.session.add(user)
        db.session.commit()

        admin_settings = UserSettings.get_or_create_for_user(admin.id)
        admin_settings.api_base_url = 'https://admin.example.test/v1'
        admin_settings.api_key = 'admin-key'
        admin_settings.text_model = 'admin-text-model'

        user_settings = UserSettings.get_or_create_for_user(user.id)
        user_settings.api_base_url = None
        user_settings.api_key = None
        user_settings.text_model = None
        db.session.commit()

        payload = build_effective_settings_payload(user.id)

        assert payload['api_base_url'] == 'https://admin.example.test/v1'
        assert payload['api_key'] == 'admin-key'
        assert payload['text_model'] == 'admin-text-model'
