"""add per-model provider config fields to settings table

Revision ID: 014
Revises: 013
Create Date: 2026-02-16

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '014'
down_revision = 'ee22f1512027'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('settings', sa.Column('text_api_key', sa.String(500), nullable=True))
    op.add_column('settings', sa.Column('text_api_base_url', sa.String(500), nullable=True))
    op.add_column('settings', sa.Column('image_api_key', sa.String(500), nullable=True))
    op.add_column('settings', sa.Column('image_api_base_url', sa.String(500), nullable=True))
    op.add_column('settings', sa.Column('image_caption_api_key', sa.String(500), nullable=True))
    op.add_column('settings', sa.Column('image_caption_api_base_url', sa.String(500), nullable=True))


def downgrade():
    op.drop_column('settings', 'image_caption_api_base_url')
    op.drop_column('settings', 'image_caption_api_key')
    op.drop_column('settings', 'image_api_base_url')
    op.drop_column('settings', 'image_api_key')
    op.drop_column('settings', 'text_api_base_url')
    op.drop_column('settings', 'text_api_key')
