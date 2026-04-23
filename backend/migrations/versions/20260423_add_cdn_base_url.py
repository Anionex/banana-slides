"""add cdn_base_url to system_config

Revision ID: 20260423_cdn_url
Revises: 20260423_xunhupay
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa

revision = '20260423_cdn_url'
down_revision = '20260423_xunhupay'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('system_config', schema=None) as batch_op:
        batch_op.add_column(sa.Column('cdn_base_url', sa.String(512), nullable=True))


def downgrade():
    with op.batch_alter_table('system_config', schema=None) as batch_op:
        batch_op.drop_column('cdn_base_url')
