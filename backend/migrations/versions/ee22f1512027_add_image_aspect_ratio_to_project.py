"""add image_aspect_ratio to project

Revision ID: ee22f1512027
Revises: 013
Create Date: 2026-02-14 01:58:15.948064

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'ee22f1512027'
down_revision = '013'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    if not _column_exists('projects', 'image_aspect_ratio'):
        op.add_column('projects', sa.Column('image_aspect_ratio', sa.String(length=10), server_default='16:9', nullable=False))


def downgrade() -> None:
    if _column_exists('projects', 'image_aspect_ratio'):
        op.drop_column('projects', 'image_aspect_ratio')
