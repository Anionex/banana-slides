"""add xunhupay credential columns to system_config

Revision ID: 20260423_xunhupay
Revises: f1e2124e2f4f
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa

revision = '20260423_xunhupay'
down_revision = 'f1e2124e2f4f'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('system_config', schema=None) as batch_op:
        batch_op.add_column(sa.Column('xunhupay_app_id', sa.String(100), nullable=True, server_default=''))
        batch_op.add_column(sa.Column('xunhupay_app_secret', sa.String(200), nullable=True, server_default=''))


def downgrade():
    with op.batch_alter_table('system_config', schema=None) as batch_op:
        batch_op.drop_column('xunhupay_app_secret')
        batch_op.drop_column('xunhupay_app_id')
