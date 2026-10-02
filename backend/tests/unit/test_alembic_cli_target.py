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
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}

    assert version == _current_head()
    assert 'image_quality' in columns
    assert not tables & {'public_visitors', 'feedback', 'waitlist_signups'}


@pytest.mark.parametrize('revision', ['public_demo_visitors', 'b82a4ddcb102', 'c42f8e9a1b70'])
def test_retired_website_revisions_remain_upgradeable(cli_env, revision):
    """Previously upgraded installs keep their data and can reach the current head."""
    db_path, env = cli_env
    result = subprocess.run(
        [sys.executable, '-m', 'alembic', 'upgrade', revision],
        cwd=BACKEND_ROOT, env=env, capture_output=True, text=True, timeout=60,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    with sqlite3.connect(db_path) as conn:
        conn.execute("INSERT INTO projects (id, idea_prompt, creation_type, status, created_at, updated_at) VALUES ('existing-project', 'Keep this presentation', 'idea', 'DRAFT', '2026-09-27', '2026-09-27')")
        # Model the tables left by the original, already released migrations.
        conn.execute('CREATE TABLE public_visitors (token_hash VARCHAR(64) PRIMARY KEY, config_json TEXT NOT NULL)')
        conn.execute("INSERT INTO public_visitors VALUES ('old-token', '{}')")
        if revision != 'public_demo_visitors':
            conn.execute('CREATE TABLE feedback (id INTEGER PRIMARY KEY, message TEXT NOT NULL, reply_email VARCHAR(254), page_path VARCHAR(300) NOT NULL, created_at DATETIME NOT NULL)')
            conn.execute("INSERT INTO feedback VALUES (1, 'Keep this report', NULL, '/', '2026-09-27')")
        if revision == 'c42f8e9a1b70':
            conn.execute('CREATE TABLE waitlist_signups (id INTEGER PRIMARY KEY, email VARCHAR(254) NOT NULL UNIQUE, created_at DATETIME NOT NULL)')
            conn.execute("INSERT INTO waitlist_signups VALUES (1, 'user@example.com', '2026-09-27')")
        before = {
            table: conn.execute(f'SELECT * FROM {table}').fetchall()
            for table in ('projects', 'public_visitors', 'feedback', 'waitlist_signups')
            if conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
        }
    result = _run_alembic_upgrade(env)
    assert result.returncode == 0, result.stdout + result.stderr
    with sqlite3.connect(db_path) as conn:
        assert conn.execute('SELECT version_num FROM alembic_version').fetchone()[0] == _current_head()
        assert 'image_quality' in {row[1] for row in conn.execute("PRAGMA table_info('settings')")}
        for table, rows in before.items():
            assert conn.execute(f'SELECT * FROM {table}').fetchall() == rows


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
