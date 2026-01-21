"""add cached_image_path to pages

Revision ID: 010_add_cached_image_path
Revises: 009_split_reasoning_config
Create Date: 2026-01-18 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '010_add_cached_image_path'
down_revision = '009_split_reasoning_config'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('pages', sa.Column('cached_image_path', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('pages', 'cached_image_path')
