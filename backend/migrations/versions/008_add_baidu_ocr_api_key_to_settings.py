"""add baidu_ocr_api_key to settings

Revision ID: 008_add_baidu_ocr_api_key
Revises: 007_add_enable_reasoning
Create Date: 2026-01-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '008_add_baidu_ocr_api_key'
down_revision = '007_add_enable_reasoning'
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
    Add baidu_ocr_api_key column to settings table.
    
    This setting stores the Baidu OCR API Key used for text recognition
    in editable PPTX export functionality.
    
    Idempotent: checks if column exists before adding.
    """
    if not _column_exists('settings', 'baidu_ocr_api_key'):
        op.add_column('settings', sa.Column('baidu_ocr_api_key', sa.String(500), nullable=True))


def downgrade() -> None:
    """
    Remove baidu_ocr_api_key column from settings table.
    """
    op.drop_column('settings', 'baidu_ocr_api_key')
