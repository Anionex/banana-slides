"""add user_style_templates table

Revision ID: 016
Revises: 015
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa

revision = '016_user_style_templates'
down_revision = 'c153f8c4e111'
branch_labels = None
depends_on = None


def upgrade():
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
    op.drop_table('user_style_templates')
