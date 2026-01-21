"""split reasoning config into text and image

Revision ID: 009_split_reasoning_config
Revises: 007_add_enable_reasoning
Create Date: 2026-01-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '009_split_reasoning_config'
down_revision = '008_add_baidu_ocr_api_key'
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
    Split enable_reasoning into separate text and image reasoning configs.
    
    - enable_text_reasoning: whether to enable reasoning for text generation
    - text_thinking_budget: thinking budget for text (1-8192)
    - enable_image_reasoning: whether to enable reasoning for image generation
    - image_thinking_budget: thinking budget for image (1-8192)
    
    Migrate existing enable_reasoning value to both new text and image flags.
    """
    # Add new columns
    if not _column_exists('settings', 'enable_text_reasoning'):
        op.add_column('settings', sa.Column('enable_text_reasoning', sa.Boolean(), nullable=False, server_default='0'))
    
    if not _column_exists('settings', 'text_thinking_budget'):
        op.add_column('settings', sa.Column('text_thinking_budget', sa.Integer(), nullable=False, server_default='1024'))
    
    if not _column_exists('settings', 'enable_image_reasoning'):
        op.add_column('settings', sa.Column('enable_image_reasoning', sa.Boolean(), nullable=False, server_default='0'))
    
    if not _column_exists('settings', 'image_thinking_budget'):
        op.add_column('settings', sa.Column('image_thinking_budget', sa.Integer(), nullable=False, server_default='1024'))
    
    # Migrate existing enable_reasoning value to new columns
    if _column_exists('settings', 'enable_reasoning'):
        # Copy enable_reasoning value to both new text and image flags
        op.execute("""
            UPDATE settings 
            SET enable_text_reasoning = enable_reasoning,
                enable_image_reasoning = enable_reasoning
        """)
        # Drop old column
        op.drop_column('settings', 'enable_reasoning')


def downgrade() -> None:
    """
    Revert to single enable_reasoning column.
    """
    # Add back old column
    if not _column_exists('settings', 'enable_reasoning'):
        op.add_column('settings', sa.Column('enable_reasoning', sa.Boolean(), nullable=False, server_default='0'))
    
    # Migrate: if either text or image reasoning is enabled, set enable_reasoning to true
    if _column_exists('settings', 'enable_text_reasoning'):
        op.execute("""
            UPDATE settings 
            SET enable_reasoning = (enable_text_reasoning OR enable_image_reasoning)
        """)
    
    # Drop new columns
    if _column_exists('settings', 'enable_text_reasoning'):
        op.drop_column('settings', 'enable_text_reasoning')
    if _column_exists('settings', 'text_thinking_budget'):
        op.drop_column('settings', 'text_thinking_budget')
    if _column_exists('settings', 'enable_image_reasoning'):
        op.drop_column('settings', 'enable_image_reasoning')
    if _column_exists('settings', 'image_thinking_budget'):
        op.drop_column('settings', 'image_thinking_budget')
