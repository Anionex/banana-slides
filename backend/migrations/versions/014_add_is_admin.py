"""Add is_admin field to users table

Revision ID: 014
Revises: 013
Create Date: 2026-02-04 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column(
        'is_admin', sa.Boolean(), nullable=False, server_default='0'
    ))


def downgrade():
    op.drop_column('users', 'is_admin')
