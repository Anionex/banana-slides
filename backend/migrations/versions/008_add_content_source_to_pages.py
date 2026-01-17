"""add content_source to pages

Revision ID: 008_add_content_source
Revises: 007_add_template_image_path
Create Date: 2025-01-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '008_add_content_source'
down_revision = '007_add_template_image_path'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add content_source field to pages table for document content mapping.
    This stores the mapping of paragraph_ids, image_ids, table_ids assigned to each page
    during outline generation, enabling page-specific content injection during description generation.
    """
    op.add_column('pages', sa.Column('content_source', sa.Text(), nullable=True))


def downgrade() -> None:
    """
    Remove content_source field from pages table.
    """
    op.drop_column('pages', 'content_source')
