"""add export settings to projects

Revision ID: 006_add_export_settings
Revises: 005_add_pdf_image_path
Create Date: 2025-01-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '006_add_export_settings'
down_revision = '005_add_pdf_image_path'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    """
    Add export settings fields to projects table.
    - export_extractor_method: Component extraction method (mineru, hybrid)
    - export_inpaint_method: Background generation method (generative, baidu, hybrid)
    """
    # Add export_extractor_method column (nullable, defaults to 'hybrid')
    if not _column_exists('projects', 'export_extractor_method'):
        op.add_column('projects', sa.Column('export_extractor_method', sa.String(50), nullable=True, server_default='hybrid'))
    
    # Add export_inpaint_method column (nullable, defaults to 'hybrid')
    if not _column_exists('projects', 'export_inpaint_method'):
        op.add_column('projects', sa.Column('export_inpaint_method', sa.String(50), nullable=True, server_default='hybrid'))


def downgrade() -> None:
    """
    Remove export settings fields from projects table.
    """
    if _column_exists('projects', 'export_inpaint_method'):
        op.drop_column('projects', 'export_inpaint_method')
    if _column_exists('projects', 'export_extractor_method'):
        op.drop_column('projects', 'export_extractor_method')


