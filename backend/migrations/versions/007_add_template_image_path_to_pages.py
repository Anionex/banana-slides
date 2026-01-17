"""add template_image_path to pages

Revision ID: 007_add_template_image_path
Revises: 006_add_export_settings
Create Date: 2025-01-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '007_add_template_image_path'
down_revision = '006_add_export_settings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add template_image_path field to pages table for page-level template support.
    This enables per-page template images instead of only project-level templates.
    """
    op.add_column('pages', sa.Column('template_image_path', sa.String(500), nullable=True))


def downgrade() -> None:
    """
    Remove template_image_path field from pages table.
    """
    op.drop_column('pages', 'template_image_path')
