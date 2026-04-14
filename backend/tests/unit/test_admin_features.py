from datetime import datetime

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


def _admin_headers(user):
    tokens = generate_tokens(user.id, user.role)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_admin_can_create_admin_user(client, db_session):
    from models import Settings, User

    super_admin = _create_user(db_session, User, "root_admin", "Root@1")
    global_settings = Settings.get_global_settings()
    global_settings.text_model = "global-text-model"
    global_settings.image_resolution = "4K"
    db_session.commit()

    response = client.post(
        "/api/admin/users",
        json={"username": "admin1", "password": "FeiYe@7"},
        headers=_admin_headers(super_admin),
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["data"]["username"] == "admin1"
    assert payload["data"]["role"] == "admin"

    created = User.query.filter_by(username="admin1").first()
    assert created is not None
    assert created.role == "admin"

    admin_settings = Settings.query.filter_by(owner_user_id=created.id).first()
    assert admin_settings is not None
    assert admin_settings.text_model is None
    assert admin_settings.image_resolution is None


def test_admin_can_change_own_password(client, db_session):
    from models import User

    admin_user = _create_user(db_session, User, "secure_admin", "Root@1")

    response = client.post(
        "/api/admin/account/password",
        json={"current_password": "Root@1", "new_password": "Better@2"},
        headers=_admin_headers(admin_user),
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


def test_admin_settings_are_isolated_between_admins(client, db_session):
    from models import Settings, User

    global_settings = Settings.get_global_settings()
    global_settings.text_model = "global-text-model"
    global_settings.image_resolution = "2K"
    db_session.commit()

    admin_one = _create_user(db_session, User, "admin_one", "Admin@1")
    admin_two = _create_user(db_session, User, "admin_two", "Admin@2")

    update_response = client.put(
        "/api/admin/settings",
        json={"text_model": "admin-one-model", "image_resolution": "4K"},
        headers=_admin_headers(admin_one),
    )
    assert update_response.status_code == 200

    admin_one_settings = client.get("/api/admin/settings", headers=_admin_headers(admin_one))
    admin_two_settings = client.get("/api/admin/settings", headers=_admin_headers(admin_two))
    global_response = client.get("/api/settings")

    assert admin_one_settings.status_code == 200
    assert admin_two_settings.status_code == 200
    assert global_response.status_code == 200

    assert admin_one_settings.get_json()["data"]["text_model"] == "admin-one-model"
    assert admin_one_settings.get_json()["data"]["image_resolution"] == "4K"

    assert admin_two_settings.get_json()["data"]["text_model"] is None
    assert admin_two_settings.get_json()["data"]["image_resolution"] is None

    assert global_response.get_json()["data"]["text_model"] == "global-text-model"
    assert global_response.get_json()["data"]["image_resolution"] == "2K"


def test_main_settings_route_uses_admin_private_settings_when_authenticated(client, db_session):
    from models import Settings, User

    global_settings = Settings.get_global_settings()
    global_settings.text_model = "global-text-model"
    global_settings.image_resolution = "2K"
    db_session.commit()

    admin_user = _create_user(db_session, User, "main_admin", "Admin@1")

    initial_response = client.get("/api/settings", headers=_admin_headers(admin_user))
    assert initial_response.status_code == 200
    assert initial_response.get_json()["data"]["text_model"] is None
    assert initial_response.get_json()["data"]["image_resolution"] is None

    update_response = client.put(
        "/api/settings",
        json={"text_model": "admin-private-model", "image_resolution": "4K"},
        headers=_admin_headers(admin_user),
    )
    assert update_response.status_code == 200
    assert update_response.get_json()["data"]["text_model"] == "admin-private-model"
    assert update_response.get_json()["data"]["image_resolution"] == "4K"

    refreshed_admin_response = client.get("/api/settings", headers=_admin_headers(admin_user))
    assert refreshed_admin_response.status_code == 200
    assert refreshed_admin_response.get_json()["data"]["text_model"] == "admin-private-model"
    assert refreshed_admin_response.get_json()["data"]["image_resolution"] == "4K"

    global_response = client.get("/api/settings")
    assert global_response.status_code == 200
    assert global_response.get_json()["data"]["text_model"] == "global-text-model"
    assert global_response.get_json()["data"]["image_resolution"] == "2K"


def test_admin_runtime_config_does_not_fallback_to_global_secrets(db_session):
    from flask import Flask
    from models import Settings, User
    from services.ai_providers import get_image_provider

    global_settings = Settings.get_global_settings()
    global_settings.ai_provider_format = "gemini"
    global_settings.api_key = "GLOBAL_SECRET_KEY"
    db_session.commit()

    admin_user = _create_user(db_session, User, "isolated_admin", "Admin@3")
    admin_settings = Settings.get_settings(admin_user)
    runtime_config = admin_settings.to_runtime_config(include_secret_defaults=False)

    assert runtime_config["GOOGLE_API_KEY"] is None
    assert runtime_config["OPENAI_API_KEY"] is None

    app = Flask(__name__)
    app.config["AI_PROVIDER_FORMAT"] = "gemini"
    app.config["GOOGLE_API_KEY"] = "GLOBAL_SECRET_KEY"

    with app.app_context():
        try:
            get_image_provider(model="test-image-model", runtime_config=runtime_config)
            assert False, "Expected provider creation to fail without admin secret"
        except ValueError as exc:
            assert "GOOGLE_API_KEY" in str(exc)
