"""add user_style_templates table

Revision ID: 016
Revises: 015
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '016_user_style_templates'
down_revision = 'c153f8c4e111'
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    return inspector.has_table(table_name)


def upgrade():
    if _table_exists('user_style_templates'):
        return

    op.create_table(
        'user_style_templates',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('color', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    if _table_exists('user_style_templates'):
        op.drop_table('user_style_templates')
