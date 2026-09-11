import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlalchemy.engine import make_url

# Add the backend directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

os.environ['BANANA_SKIP_AUTO_MIGRATE'] = '1'

from models import db

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# target_metadata is used for autogenerate support.
target_metadata = db.metadata


def get_url() -> str:
    """Resolve the database to migrate.

    Priority:
        1. an explicit ``sqlalchemy.url`` override on the Alembic config — this
           is what app.py sets to the live Flask database before upgrading
        2. ``DATABASE_URL``
        3. the application Config (``backend/instance/database.db``)
        4. a local instance path as a last resort

    alembic.ini must not hardcode a URL: it used to hold a placeholder value
    that shadowed ``DATABASE_URL``, so `alembic upgrade head` migrated a
    scratch database and left the real one behind.
    """
    override = (config.get_main_option("sqlalchemy.url") or "").strip()
    if override:
        _ensure_sqlite_dir(override)
        return override

    env_url = (os.getenv("DATABASE_URL") or "").strip()
    if env_url:
        _ensure_sqlite_dir(env_url)
        return env_url

    try:
        from config import Config

        app_url = (getattr(Config, "SQLALCHEMY_DATABASE_URI", "") or "").strip()
        if app_url:
            _ensure_sqlite_dir(app_url)
            return app_url
    except Exception:  # pragma: no cover - config import must never block migrations
        pass

    fallback = "sqlite:///instance/database.db"
    _ensure_sqlite_dir(fallback)
    return fallback


def _ensure_sqlite_dir(url: str) -> None:
    """Create the parent directory of a file-based SQLite database.

    A fresh clone has no ``backend/instance`` directory (only app.py creates it),
    and SQLite cannot create missing directories itself: without this,
    `alembic upgrade head` fails with "unable to open database file" before the
    application ever starts.
    """
    try:
        parsed = make_url(url)
    except Exception:
        return
    if not parsed.drivername.startswith("sqlite"):
        return
    database = parsed.database or ""
    if not database or database == ":memory:":
        return
    parent = os.path.dirname(os.path.abspath(database))
    if parent:
        os.makedirs(parent, exist_ok=True)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        {"sqlalchemy.url": get_url()},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
