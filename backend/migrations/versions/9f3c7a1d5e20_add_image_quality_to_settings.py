"""add image_quality to settings

Revision ID: 9f3c7a1d5e20
Revises: public_demo_visitors
Create Date: 2026-09-09 19:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '9f3c7a1d5e20'
down_revision = 'public_demo_visitors'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    if not _column_exists('settings', 'image_quality'):
        op.add_column('settings', sa.Column('image_quality', sa.String(length=10), nullable=True))


def downgrade() -> None:
    if _column_exists('settings', 'image_quality'):
        op.drop_column('settings', 'image_quality')
