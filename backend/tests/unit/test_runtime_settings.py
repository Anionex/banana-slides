"""
Runtime settings arbitration unit tests.
"""


def test_default_settings_source_uses_global_settings(app):
    from models import db, Settings
    from services.runtime_settings import get_default_settings_source

    with app.app_context():
        settings = Settings.get_settings()
        settings.ai_provider_format = 'openai'
        settings.api_base_url = 'https://global.example.test/v1'
        settings.api_key = 'global-key'
        settings.text_model = 'global-text-model'
        db.session.commit()

        default_source = get_default_settings_source()

        assert default_source.ai_provider_format == 'openai'
        assert default_source.api_base_url == 'https://global.example.test/v1'
        assert default_source.api_key == 'global-key'
        assert default_source.text_model == 'global-text-model'


def test_effective_settings_override_prefers_user_and_falls_back_to_global_settings(app):
    from models import db, Settings, User, UserSettings, SystemConfig
    from services.runtime_settings import build_effective_settings_override

    with app.app_context():
        settings = Settings.get_settings()
        settings.ai_provider_format = 'openai'
        settings.api_base_url = 'https://global.example.test/v1'
        settings.api_key = 'global-key'
        settings.text_model = 'global-text-model'
        settings.image_model = 'global-image-model'
        settings.image_resolution = '2K'

        # Allow image_model and image_resolution to be user-editable
        config = SystemConfig.get_instance()
        config.set_user_editable_fields(['image_model', 'image_resolution', 'output_language'])
        db.session.commit()


        user = User(
            email='runtime-user@example.com',
            username='runtime-user',
            password_hash='hash',
            is_admin=False,
            email_verified=True,
        )
        db.session.add(user)
        db.session.commit()

        user_settings = UserSettings.get_or_create_for_user(user.id)
        user_settings.image_model = 'user-image-model'
        user_settings.image_resolution = '4K'
        db.session.commit()

        override = build_effective_settings_override(user.id)

        assert override['AI_PROVIDER_FORMAT'] == 'openai'
        assert override['GOOGLE_API_BASE'] == 'https://global.example.test/v1'
        assert override['GOOGLE_API_KEY'] == 'global-key'
        assert override['TEXT_MODEL'] == 'global-text-model'
        assert override['IMAGE_MODEL'] == 'user-image-model'
        assert override['DEFAULT_RESOLUTION'] == '4K'


def test_effective_settings_payload_uses_global_defaults_for_missing_user_overrides(app):
    from models import db, Settings, User, UserSettings
    from services.runtime_settings import build_effective_settings_payload

    with app.app_context():
        settings = Settings.get_settings()
        settings.api_base_url = 'https://global.example.test/v1'
        settings.api_key = 'global-key'
        settings.text_model = 'global-text-model'
        settings.image_resolution = '2K'


        user = User(
            email='runtime-user-2@example.com',
            username='runtime-user-2',
            password_hash='hash',
            is_admin=False,
            email_verified=True,
        )
        db.session.add(user)
        db.session.commit()

        user_settings = UserSettings.get_or_create_for_user(user.id)
        user_settings.image_resolution = '4K'
        db.session.commit()

        payload = build_effective_settings_payload(user.id)

        assert payload['api_base_url'] == 'https://global.example.test/v1'
        assert payload['api_key'] == 'global-key'
        assert payload['text_model'] == 'global-text-model'
        assert payload['image_resolution'] == '4K'
