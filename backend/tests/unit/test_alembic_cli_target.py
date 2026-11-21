"""`alembic upgrade head` must migrate the application database.

Regression: alembic.ini used to hardcode `sqlalchemy.url = sqlite:///placeholder.db`,
which migrations/env.py preferred over DATABASE_URL. The documented command (and
the launchd `alembic upgrade head && python app.py`) therefore migrated a scratch
file and left the real database un-migrated; the API then answered
`no such column: settings.image_quality` until someone migrated it by hand.
"""

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest
from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory


BACKEND_ROOT = Path(__file__).resolve().parents[2]


def _current_head() -> str:
    config = AlembicConfig(str(BACKEND_ROOT / 'alembic.ini'))
    config.set_main_option('script_location', str(BACKEND_ROOT / 'migrations'))
    return ScriptDirectory.from_config(config).get_heads()[0]


def _run_alembic_upgrade(env: dict) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, '-m', 'alembic', 'upgrade', 'head'],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )


@pytest.fixture
def cli_env(tmp_path):
    db_path = tmp_path / 'cli_target.db'
    env = {k: v for k, v in os.environ.items() if k != 'BANANA_SKIP_AUTO_MIGRATE'}
    env['DATABASE_URL'] = f'sqlite:///{db_path}'
    return db_path, env


def test_cli_migrates_database_url(cli_env):
    """The CLI must honour DATABASE_URL instead of a placeholder URL."""
    db_path, env = cli_env

    result = _run_alembic_upgrade(env)

    assert result.returncode == 0, result.stdout + result.stderr
    assert db_path.exists(), (
        'alembic upgrade ran against a different database than DATABASE_URL'
    )

    with sqlite3.connect(db_path) as conn:
        version = conn.execute('SELECT version_num FROM alembic_version').fetchone()[0]
        columns = {row[1] for row in conn.execute("PRAGMA table_info('settings')")}

    assert version == _current_head()
    assert 'image_quality' in columns


def test_cli_is_idempotent(cli_env):
    """Re-running upgrade head on an up-to-date database is a no-op."""
    db_path, env = cli_env
    assert _run_alembic_upgrade(env).returncode == 0

    second = _run_alembic_upgrade(env)

    assert second.returncode == 0, second.stdout + second.stderr
    with sqlite3.connect(db_path) as conn:
        assert conn.execute('SELECT version_num FROM alembic_version').fetchone()[0] == _current_head()


def test_cli_creates_missing_sqlite_directory(tmp_path):
    """A fresh clone has no backend/instance directory yet; the documented
    `alembic upgrade head` must still work before the app has ever started."""
    db_path = tmp_path / 'fresh' / 'nested' / 'instance.db'
    env = {k: v for k, v in os.environ.items() if k != 'BANANA_SKIP_AUTO_MIGRATE'}
    env['DATABASE_URL'] = f'sqlite:///{db_path}'

    result = _run_alembic_upgrade(env)

    assert result.returncode == 0, result.stdout + result.stderr
    assert db_path.exists()
    with sqlite3.connect(db_path) as conn:
        assert conn.execute('SELECT version_num FROM alembic_version').fetchone()[0] == _current_head()


def test_explicit_config_override_still_wins(tmp_path):
    """app.py sets sqlalchemy.url programmatically (desktop/自定义库路径);
    that override must beat DATABASE_URL."""
    override_db = tmp_path / 'override.db'
    other_db = tmp_path / 'env.db'
    env = {k: v for k, v in os.environ.items() if k != 'BANANA_SKIP_AUTO_MIGRATE'}
    env['DATABASE_URL'] = f'sqlite:///{other_db}'

    result = subprocess.run(
        [
            sys.executable,
            '-c',
            (
                'from alembic import command\n'
                'from alembic.config import Config\n'
                "cfg = Config('alembic.ini')\n"
                f"cfg.set_main_option('sqlalchemy.url', 'sqlite:///{override_db}')\n"
                "command.upgrade(cfg, 'head')\n"
            ),
        ],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert override_db.exists()
    assert not other_db.exists(), 'the explicit override must take precedence'
    with sqlite3.connect(override_db) as conn:
        assert conn.execute('SELECT version_num FROM alembic_version').fetchone()[0] == _current_head()
