"""add lazyllm source fields to settings table

Revision ID: 013
Revises: 012
Create Date: 2026-02-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade():
    if not _column_exists('settings', 'text_model_source'):
        op.add_column('settings', sa.Column('text_model_source', sa.String(50), nullable=True))
    if not _column_exists('settings', 'image_model_source'):
        op.add_column('settings', sa.Column('image_model_source', sa.String(50), nullable=True))
    if not _column_exists('settings', 'image_caption_model_source'):
        op.add_column('settings', sa.Column('image_caption_model_source', sa.String(50), nullable=True))
    if not _column_exists('settings', 'lazyllm_api_keys'):
        op.add_column('settings', sa.Column('lazyllm_api_keys', sa.Text(), nullable=True))


def downgrade():
    if _column_exists('settings', 'lazyllm_api_keys'):
        op.drop_column('settings', 'lazyllm_api_keys')
    if _column_exists('settings', 'image_caption_model_source'):
        op.drop_column('settings', 'image_caption_model_source')
    if _column_exists('settings', 'image_model_source'):
        op.drop_column('settings', 'image_model_source')
    if _column_exists('settings', 'text_model_source'):
        op.drop_column('settings', 'text_model_source')
