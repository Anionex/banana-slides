"""add per-model provider config fields to settings table

Revision ID: 014
Revises: 013
Create Date: 2026-02-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '014'
down_revision = 'ee22f1512027'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade():
    if not _column_exists('settings', 'text_api_key'):
        op.add_column('settings', sa.Column('text_api_key', sa.String(500), nullable=True))
    if not _column_exists('settings', 'text_api_base_url'):
        op.add_column('settings', sa.Column('text_api_base_url', sa.String(500), nullable=True))
    if not _column_exists('settings', 'image_api_key'):
        op.add_column('settings', sa.Column('image_api_key', sa.String(500), nullable=True))
    if not _column_exists('settings', 'image_api_base_url'):
        op.add_column('settings', sa.Column('image_api_base_url', sa.String(500), nullable=True))
    if not _column_exists('settings', 'image_caption_api_key'):
        op.add_column('settings', sa.Column('image_caption_api_key', sa.String(500), nullable=True))
    if not _column_exists('settings', 'image_caption_api_base_url'):
        op.add_column('settings', sa.Column('image_caption_api_base_url', sa.String(500), nullable=True))


def downgrade():
    if _column_exists('settings', 'image_caption_api_base_url'):
        op.drop_column('settings', 'image_caption_api_base_url')
    if _column_exists('settings', 'image_caption_api_key'):
        op.drop_column('settings', 'image_caption_api_key')
    if _column_exists('settings', 'image_api_base_url'):
        op.drop_column('settings', 'image_api_base_url')
    if _column_exists('settings', 'image_api_key'):
        op.drop_column('settings', 'image_api_key')
    if _column_exists('settings', 'text_api_base_url'):
        op.drop_column('settings', 'text_api_base_url')
    if _column_exists('settings', 'text_api_key'):
        op.drop_column('settings', 'text_api_key')
