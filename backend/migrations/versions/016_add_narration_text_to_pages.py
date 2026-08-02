"""add narration_text to pages

Revision ID: 016_add_narration_text_to_pages
Revises: 9ad736fec43d
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '016_add_narration_text_to_pages'
down_revision = '9ad736fec43d'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    if not _column_exists('pages', 'narration_text'):
        op.add_column('pages', sa.Column('narration_text', sa.Text(), nullable=True))


def downgrade() -> None:
    if _column_exists('pages', 'narration_text'):
        op.drop_column('pages', 'narration_text')
