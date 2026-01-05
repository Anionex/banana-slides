"""add export settings to projects

Revision ID: 006_add_export_settings
Revises: 005_add_pdf_image_path
Create Date: 2025-01-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '006_add_export_settings'
down_revision = '005_add_pdf_image_path'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add export settings fields to projects table.
    - export_extractor_method: Component extraction method (mineru, hybrid)
    - export_inpaint_method: Background generation method (generative, baidu, hybrid)
    """
    # Add export_extractor_method column (nullable, defaults to 'hybrid')
    op.add_column('projects', sa.Column('export_extractor_method', sa.String(50), nullable=True, server_default='hybrid'))
    
    # Add export_inpaint_method column (nullable, defaults to 'hybrid')
    op.add_column('projects', sa.Column('export_inpaint_method', sa.String(50), nullable=True, server_default='hybrid'))


def downgrade() -> None:
    """
    Remove export settings fields from projects table.
    """
    op.drop_column('projects', 'export_inpaint_method')
    op.drop_column('projects', 'export_extractor_method')



