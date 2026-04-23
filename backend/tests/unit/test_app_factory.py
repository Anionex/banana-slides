"""Application factory tests."""


def test_create_app_respects_database_url(monkeypatch, tmp_path):
    from app import create_app
    from models import db

    db_path = tmp_path / "factory-test.db"
    database_url = f"sqlite:///{db_path}"
    monkeypatch.setenv("DATABASE_URL", database_url)

    app = create_app()

    assert app.config["SQLALCHEMY_DATABASE_URI"] == database_url

    with app.app_context():
        assert str(db.engine.url) == database_url
