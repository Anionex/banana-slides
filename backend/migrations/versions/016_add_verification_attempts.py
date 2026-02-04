"""Add verification_attempts to users table

Revision ID: 016
Revises: 015
Create Date: 2026-02-04 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '016'
down_revision = '015'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('verification_attempts', sa.Integer(), nullable=True, server_default='0'))


def downgrade():
    op.drop_column('users', 'verification_attempts')
