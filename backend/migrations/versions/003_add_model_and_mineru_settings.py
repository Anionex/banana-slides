"""add model and mineru settings to settings table

Revision ID: 003_new_fields
Revises: 002_settings
Create Date: 2025-12-17 22:02:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '003_new_fields'
down_revision = '002_settings'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    """检查列是否存在"""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    """
    Add new model and MinerU configuration fields to settings table.
    
    Idempotent: checks each column before adding.
    """
    # Add text_model column if not exists
    if not _column_exists('settings', 'text_model'):
        op.add_column('settings', sa.Column('text_model', sa.String(length=100), nullable=True))
    
    # Add image_model column if not exists
    if not _column_exists('settings', 'image_model'):
        op.add_column('settings', sa.Column('image_model', sa.String(length=100), nullable=True))
    
    # Add mineru_api_base column if not exists
    if not _column_exists('settings', 'mineru_api_base'):
        op.add_column('settings', sa.Column('mineru_api_base', sa.String(length=255), nullable=True))
    
    # Add image_caption_model column if not exists
    if not _column_exists('settings', 'image_caption_model'):
        op.add_column('settings', sa.Column('image_caption_model', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('settings', 'image_caption_model')
    op.drop_column('settings', 'mineru_api_base')
    op.drop_column('settings', 'image_model')
    op.drop_column('settings', 'text_model')

