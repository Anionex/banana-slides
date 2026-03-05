"""add enable_reasoning to settings

Revision ID: 007_add_enable_reasoning
Revises: 006_add_export_settings
Create Date: 2025-01-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '007_add_enable_reasoning'
down_revision = '006_add_export_settings'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    """Check if column exists"""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    """
    Add enable_reasoning column to settings table with default value False.
    
    This setting controls whether AI models should use extended thinking/reasoning mode.
    When enabled, supported models will use deeper reasoning which may improve quality
    but increases response time and token consumption.
    
    Idempotent: checks if column exists before adding.
    """
    if not _column_exists('settings', 'enable_reasoning'):
        op.add_column('settings', sa.Column('enable_reasoning', sa.Boolean(), nullable=False, server_default='0'))


def downgrade() -> None:
    """
    Remove enable_reasoning column from settings table.
    """
    op.drop_column('settings', 'enable_reasoning')
