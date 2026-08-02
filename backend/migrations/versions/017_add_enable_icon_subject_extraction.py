"""add enable_icon_subject_extraction to projects

Revision ID: 017_icon_subject_ext
Revises: 017_add_elevenlabs_to_settings
Create Date: 2026-05-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = '017_icon_subject_ext'
down_revision = '017_add_elevenlabs_to_settings'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    """Add enable_icon_subject_extraction column to projects table.

    When enabled (default), small icon-like images extracted during editable
    PPTX export will be passed through the local RMBG-2.0 model to produce
    transparent-background PNGs. Falls back to the original rectangle crop
    on failure.
    """
    if not _column_exists('projects', 'enable_icon_subject_extraction'):
        op.add_column(
            'projects',
            sa.Column(
                'enable_icon_subject_extraction',
                sa.Boolean(),
                nullable=True,
                server_default=sa.true(),
            ),
        )


def downgrade() -> None:
    if _column_exists('projects', 'enable_icon_subject_extraction'):
        op.drop_column('projects', 'enable_icon_subject_extraction')
