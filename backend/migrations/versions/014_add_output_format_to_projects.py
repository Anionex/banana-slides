"""add output_format to projects

Revision ID: 014
Revises: 013
Create Date: 2026-02-03
"""
from alembic import op
import sqlalchemy as sa

revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.add_column(sa.Column('output_format', sa.String(20), nullable=False, server_default='ppt'))


def downgrade():
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.drop_column('output_format')
