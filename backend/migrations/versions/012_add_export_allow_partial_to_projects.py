"""add export_allow_partial to projects table

Revision ID: 012
Revises: 011
Create Date: 2025-01-29

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '012'
down_revision = '011'
branch_labels = None
depends_on = None


def upgrade():
    # Add export_allow_partial column to projects table
    op.add_column('projects', sa.Column('export_allow_partial', sa.Boolean(), nullable=True, server_default='0'))


def downgrade():
    op.drop_column('projects', 'export_allow_partial')
