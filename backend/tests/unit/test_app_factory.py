import importlib
import logging
import hashlib


def _reload_app_module():
    config_module = importlib.import_module('config')
    importlib.reload(config_module)
    app_module = importlib.import_module('app')
    return importlib.reload(app_module)


def _set_test_env(monkeypatch, tmp_path):
    db_path = tmp_path / 'isolated-test.db'
    db_uri = f'sqlite:///{db_path}'

    monkeypatch.delenv('DATABASE_PATH', raising=False)
    monkeypatch.setenv('DATABASE_URL', db_uri)
    monkeypatch.setenv('TESTING', 'true')
    monkeypatch.setenv('FLASK_ENV', 'testing')

    return db_uri


def test_create_app_respects_database_url_env(monkeypatch, tmp_path):
    db_uri = _set_test_env(monkeypatch, tmp_path)

    app_module = _reload_app_module()

    flask_app = app_module.create_app()

    assert flask_app.config['SQLALCHEMY_DATABASE_URI'] == db_uri


def test_create_app_accepts_relative_database_path_env(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv('DATABASE_URL', raising=False)
    monkeypatch.setenv('DATABASE_PATH', ' desktop.db ')
    monkeypatch.setenv('TESTING', 'true')
    monkeypatch.setenv('FLASK_ENV', 'testing')

    app_module = _reload_app_module()

    flask_app = app_module.create_app()

    assert flask_app.config['SQLALCHEMY_DATABASE_URI'] == f"sqlite:///{tmp_path / 'desktop.db'}"


def test_create_app_prefers_database_path_over_database_url(monkeypatch, tmp_path):
    db_path = tmp_path / 'desktop.db'
    monkeypatch.setenv('DATABASE_URL', 'sqlite:////should/not/win.db')
    monkeypatch.setenv('DATABASE_PATH', f' {db_path} ')
    monkeypatch.setenv('TESTING', 'true')
    monkeypatch.setenv('FLASK_ENV', 'testing')

    app_module = _reload_app_module()

    flask_app = app_module.create_app()

    assert flask_app.config['SQLALCHEMY_DATABASE_URI'] == f"sqlite:///{db_path}"


def test_create_app_defaults_werkzeug_log_level_to_info(monkeypatch, tmp_path):
    _set_test_env(monkeypatch, tmp_path)
    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    monkeypatch.setenv('LOG_LEVEL', 'ERROR')
    monkeypatch.delenv('WERKZEUG_LOG_LEVEL', raising=False)

    app_module = _reload_app_module()

    flask_app = app_module.create_app()

    assert flask_app.config['LOG_LEVEL'] == 'ERROR'
    assert flask_app.config['WERKZEUG_LOG_LEVEL'] == 'INFO'
    assert logging.getLogger('werkzeug').level == logging.INFO


def test_create_app_respects_werkzeug_log_level_env(monkeypatch, tmp_path):
    _set_test_env(monkeypatch, tmp_path)
    logging.getLogger('werkzeug').setLevel(logging.ERROR)
    monkeypatch.setenv('LOG_LEVEL', 'DEBUG')
    monkeypatch.setenv('WERKZEUG_LOG_LEVEL', ' warning ')

    app_module = _reload_app_module()

    flask_app = app_module.create_app()

    assert flask_app.config['LOG_LEVEL'] == 'DEBUG'
    assert flask_app.config['WERKZEUG_LOG_LEVEL'] == 'WARNING'
    assert logging.getLogger('werkzeug').level == logging.WARNING


def test_create_app_accepts_numeric_string_werkzeug_log_level(monkeypatch, tmp_path):
    _set_test_env(monkeypatch, tmp_path)
    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    monkeypatch.setenv('WERKZEUG_LOG_LEVEL', '40')

    app_module = _reload_app_module()

    flask_app = app_module.create_app()

    assert flask_app.config['WERKZEUG_LOG_LEVEL'] == '40'
    assert logging.getLogger('werkzeug').level == logging.ERROR


def test_create_app_treats_empty_werkzeug_log_level_env_as_info(monkeypatch, tmp_path):
    _set_test_env(monkeypatch, tmp_path)
    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    monkeypatch.setenv('WERKZEUG_LOG_LEVEL', '')

    app_module = _reload_app_module()

    flask_app = app_module.create_app()

    assert flask_app.config['WERKZEUG_LOG_LEVEL'] == 'INFO'
    assert logging.getLogger('werkzeug').level == logging.INFO


def test_create_app_accepts_numeric_werkzeug_log_level_config(monkeypatch, tmp_path):
    _set_test_env(monkeypatch, tmp_path)
    logging.getLogger('werkzeug').setLevel(logging.WARNING)

    app_module = _reload_app_module()
    monkeypatch.setattr(app_module.Config, 'WERKZEUG_LOG_LEVEL', logging.ERROR)

    flask_app = app_module.create_app()

    assert flask_app.config['WERKZEUG_LOG_LEVEL'] == logging.ERROR
    assert logging.getLogger('werkzeug').level == logging.ERROR


def test_create_app_strips_programmatic_werkzeug_log_level_config(monkeypatch, tmp_path):
    _set_test_env(monkeypatch, tmp_path)
    logging.getLogger('werkzeug').setLevel(logging.WARNING)

    app_module = _reload_app_module()
    monkeypatch.setattr(app_module.Config, 'WERKZEUG_LOG_LEVEL', ' ERROR ')

    flask_app = app_module.create_app()

    assert flask_app.config['WERKZEUG_LOG_LEVEL'] == ' ERROR '
    assert logging.getLogger('werkzeug').level == logging.ERROR


def test_create_app_falls_back_for_invalid_werkzeug_log_level_config(monkeypatch, tmp_path):
    _set_test_env(monkeypatch, tmp_path)
    logging.getLogger('werkzeug').setLevel(logging.WARNING)

    app_module = _reload_app_module()
    monkeypatch.setattr(app_module.Config, 'WERKZEUG_LOG_LEVEL', object())

    app_module.create_app()

    assert logging.getLogger('werkzeug').level == logging.INFO


def test_default_ports_move_away_from_common_conflicts(monkeypatch, tmp_path):
    _set_test_env(monkeypatch, tmp_path)

    app_module = _reload_app_module()

    assert app_module.DEFAULT_FRONTEND_PORT == 3011
    assert app_module.DEFAULT_BACKEND_PORT == 5011


def test_compute_worktree_backend_port_uses_new_default_base(monkeypatch, tmp_path):
    _set_test_env(monkeypatch, tmp_path)

    app_module = _reload_app_module()
    offset = int(
        hashlib.md5(app_module._project_root.name.encode()).hexdigest()[:8],
        16,
    ) % 500

    assert app_module._compute_worktree_port(app_module.DEFAULT_BACKEND_PORT) == 5011 + offset


def test_config_default_cors_matches_new_frontend_port(monkeypatch):
    monkeypatch.delenv('CORS_ORIGINS', raising=False)

    config_module = importlib.import_module('config')
    config_module = importlib.reload(config_module)

    assert config_module.Config.CORS_ORIGINS == ['http://localhost:3011']
