from datetime import datetime
import json

from utils.auth import generate_tokens


def _hash_password(password: str) -> str:
    import bcrypt

    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _create_user(db_session, User, username: str, password: str, role: str = "admin"):
    user = User(
        username=username,
        password_hash=_hash_password(password),
        role=role,
        points=0,
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    return user


def _auth_headers(user):
    tokens = generate_tokens(user.id, user.role)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_admin_can_create_internal_user_with_empty_private_settings(client, db_session):
    from models import Settings, User

    super_admin = _create_user(db_session, User, "root_admin", "Root@1", role="admin")
    shared_settings = Settings.get_global_settings()
    shared_settings.text_model = "global-text-model"
    shared_settings.image_resolution = "4K"
    db_session.commit()

    response = client.post(
        "/api/admin/users",
        json={"username": "admin1", "password": "FeiYe@7", "role": "internal"},
        headers=_auth_headers(super_admin),
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["data"]["username"] == "admin1"
    assert payload["data"]["role"] == "internal"

    created = User.query.filter_by(username="admin1").first()
    assert created is not None
    assert created.role == "internal"

    private_settings = Settings.query.filter_by(owner_user_id=created.id).first()
    assert private_settings is not None
    assert private_settings.text_model is None
    assert private_settings.image_resolution is None


def test_admin_can_change_own_password(client, db_session):
    from models import User

    admin_user = _create_user(db_session, User, "secure_admin", "Root@1", role="admin")

    response = client.post(
        "/api/admin/account/password",
        json={"current_password": "Root@1", "new_password": "Better@2"},
        headers=_auth_headers(admin_user),
    )

    assert response.status_code == 200

    old_login = client.post(
        "/api/admin/login",
        json={"username": "secure_admin", "password": "Root@1"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/admin/login",
        json={"username": "secure_admin", "password": "Better@2"},
    )
    assert new_login.status_code == 200


def test_admin_settings_route_uses_shared_platform_settings(client, db_session):
    from models import Settings, User

    shared_settings = Settings.get_global_settings()
    shared_settings.text_model = "shared-text-model"
    shared_settings.image_resolution = "2K"
    db_session.commit()

    admin_one = _create_user(db_session, User, "admin", "Admin@1", role="admin")
    admin_two = _create_user(db_session, User, "admin_ops", "Admin@2", role="admin")

    update_response = client.put(
        "/api/admin/settings",
        json={"text_model": "platform-model", "image_resolution": "4K"},
        headers=_auth_headers(admin_one),
    )
    assert update_response.status_code == 200

    admin_one_settings = client.get("/api/admin/settings", headers=_auth_headers(admin_one))
    admin_two_settings = client.get("/api/admin/settings", headers=_auth_headers(admin_two))
    global_response = client.get("/api/settings")

    assert admin_one_settings.status_code == 200
    assert admin_two_settings.status_code == 200
    assert global_response.status_code == 200

    assert admin_one_settings.get_json()["data"]["text_model"] == "platform-model"
    assert admin_two_settings.get_json()["data"]["text_model"] == "platform-model"
    assert global_response.get_json()["data"]["text_model"] == "platform-model"


def test_main_settings_route_uses_internal_private_settings(client, db_session):
    from models import Settings, User

    shared_settings = Settings.get_global_settings()
    shared_settings.text_model = "shared-text-model"
    shared_settings.image_resolution = "2K"
    db_session.commit()

    internal_user = _create_user(db_session, User, "admin1", "Admin@1", role="internal")

    initial_response = client.get("/api/settings", headers=_auth_headers(internal_user))
    assert initial_response.status_code == 200
    assert initial_response.get_json()["data"]["text_model"] is None
    assert initial_response.get_json()["data"]["image_resolution"] is None

    update_response = client.put(
        "/api/settings",
        json={"text_model": "internal-private-model", "image_resolution": "4K"},
        headers=_auth_headers(internal_user),
    )
    assert update_response.status_code == 200
    assert update_response.get_json()["data"]["text_model"] == "internal-private-model"
    assert update_response.get_json()["data"]["image_resolution"] == "4K"

    refreshed_internal_response = client.get("/api/settings", headers=_auth_headers(internal_user))
    assert refreshed_internal_response.status_code == 200
    assert refreshed_internal_response.get_json()["data"]["text_model"] == "internal-private-model"
    assert refreshed_internal_response.get_json()["data"]["image_resolution"] == "4K"

    global_response = client.get("/api/settings")
    assert global_response.status_code == 200
    assert global_response.get_json()["data"]["text_model"] == "shared-text-model"
    assert global_response.get_json()["data"]["image_resolution"] == "2K"


def test_internal_runtime_config_does_not_fallback_to_shared_secrets(db_session):
    from flask import Flask
    from models import Settings, User
    from services.ai_providers import get_image_provider

    shared_settings = Settings.get_global_settings()
    shared_settings.ai_provider_format = "gemini"
    shared_settings.api_key = "GLOBAL_SECRET_KEY"
    db_session.commit()

    internal_user = _create_user(db_session, User, "admin3", "Admin@3", role="internal")
    internal_settings = Settings.get_settings(internal_user)
    runtime_config = internal_settings.to_runtime_config(include_secret_defaults=False)

    assert runtime_config["GOOGLE_API_KEY"] is None
    assert runtime_config["OPENAI_API_KEY"] is None

    app = Flask(__name__)
    app.config["AI_PROVIDER_FORMAT"] = "gemini"
    app.config["GOOGLE_API_KEY"] = "GLOBAL_SECRET_KEY"

    with app.app_context():
        try:
            get_image_provider(model="test-image-model", runtime_config=runtime_config)
            assert False, "Expected provider creation to fail without internal secret"
        except ValueError as exc:
            assert "GOOGLE_API_KEY" in str(exc)


def test_internal_runtime_config_uses_private_extra_fields(db_session):
    from models import Settings, User
    from services.ai_service import AIService

    shared_settings = Settings.get_global_settings()
    shared_settings.description_extra_fields = json.dumps(
        ["共享字段A", "共享字段B"],
        ensure_ascii=False,
    )
    db_session.commit()

    internal_user = _create_user(db_session, User, "admin_internal_fields", "Admin@4", role="internal")
    internal_settings = Settings.get_settings(internal_user)
    internal_settings.description_extra_fields = json.dumps(
        ["内部字段A", "内部字段B"],
        ensure_ascii=False,
    )
    db_session.commit()

    runtime_config = internal_settings.to_runtime_config(include_secret_defaults=False)
    ai_service = AIService(runtime_config=runtime_config)

    assert ai_service._get_extra_field_names() == ["内部字段A", "内部字段B"]


def test_output_language_route_uses_private_settings_for_internal_user(client, db_session):
    from models import Settings, User

    shared_settings = Settings.get_global_settings()
    shared_settings.output_language = "en"
    db_session.commit()

    internal_user = _create_user(db_session, User, "internal_lang_user", "Admin@5", role="internal")
    internal_settings = Settings.get_settings(internal_user)
    internal_settings.output_language = "ja"
    db_session.commit()

    anonymous_response = client.get("/api/output-language")
    internal_response = client.get("/api/output-language", headers=_auth_headers(internal_user))

    assert anonymous_response.status_code == 200
    assert internal_response.status_code == 200
    assert anonymous_response.get_json()["data"]["language"] == "en"
    assert internal_response.get_json()["data"]["language"] == "ja"
