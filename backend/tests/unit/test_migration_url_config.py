from migrations.url_config import select_database_url


def test_environment_database_url_overrides_alembic_placeholder():
    assert select_database_url(
        "mysql+pymysql://banana@mysql/banana_slides",
        "sqlite:///placeholder.db",
    ) == "mysql+pymysql://banana@mysql/banana_slides"


def test_configured_url_is_used_without_environment_override():
    assert select_database_url(None, "sqlite:///desktop.db") == "sqlite:///desktop.db"


def test_database_url_has_a_desktop_fallback():
    assert select_database_url(None, None) == "sqlite:///instance/database.db"
