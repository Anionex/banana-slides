import importlib


def test_create_app_respects_database_url_env(monkeypatch, tmp_path):
    db_path = tmp_path / 'isolated-test.db'
    db_uri = f'sqlite:///{db_path}'

    monkeypatch.setenv('DATABASE_URL', db_uri)
    monkeypatch.setenv('TESTING', 'true')
    monkeypatch.setenv('FLASK_ENV', 'testing')

    app_module = importlib.import_module('app')
    app_module = importlib.reload(app_module)

    flask_app = app_module.create_app()

    assert flask_app.config['SQLALCHEMY_DATABASE_URI'] == db_uri
