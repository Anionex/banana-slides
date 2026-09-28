"""The public demo can receive feedback before its other migrations are upgraded."""
import sqlite3
from pathlib import Path

from alembic import command
from alembic.config import Config


def test_feedback_migration_preserves_existing_backport_table(tmp_path):
    database = tmp_path / 'feedback.db'
    config = Config(str(Path(__file__).resolve().parents[2] / 'alembic.ini'))
    config.set_main_option('sqlalchemy.url', f'sqlite:///{database}')
    command.upgrade(config, 'hosted_beta_waitlist')
    with sqlite3.connect(database) as connection:
        connection.executescript('''
            CREATE TABLE feedback (
                id INTEGER PRIMARY KEY,
                message TEXT NOT NULL,
                reply_email VARCHAR(254),
                page_path VARCHAR(300) NOT NULL,
                created_at DATETIME NOT NULL
            );
            CREATE INDEX ix_feedback_created_at ON feedback (created_at);
            INSERT INTO feedback (message, page_path, created_at)
            VALUES ('already received', '/', '2026-09-27 00:00:00');
        ''')
    command.upgrade(config, 'head')
    with sqlite3.connect(database) as connection:
        assert connection.execute('SELECT message FROM feedback').fetchone()[0] == 'already received'
        assert connection.execute('SELECT version_num FROM alembic_version').fetchone()[0] == 'c62f8e4d19a0'
        assert connection.execute("SELECT name FROM sqlite_master WHERE name = 'feedback_image'").fetchone()[0] == 'feedback_image'
