"""Database URL selection shared by the Alembic runtime and tests."""


def select_database_url(environment_url: str | None, configured_url: str | None) -> str:
    """Prefer the deployment URL over the local Alembic placeholder."""
    return environment_url or configured_url or "sqlite:///instance/database.db"
