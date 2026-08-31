"""add requested project page count

Revision ID: 021_project_page_count
Revises: 020_platform_receipts
"""
from alembic import op
import sqlalchemy as sa


revision = '021_project_page_count'
down_revision = '020_platform_receipts'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('projects', sa.Column('page_count', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('projects', 'page_count')
