"""Add the global text output limit.

Revision ID: d84c2a7f9130
Revises: c42f8e9a1b70
"""
from alembic import op
import sqlalchemy as sa

revision = 'd84c2a7f9130'
down_revision = 'c42f8e9a1b70'
branch_labels = None
depends_on = None


def upgrade():
    columns = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('settings')}
    if 'text_max_output_tokens' not in columns:
        op.add_column('settings', sa.Column('text_max_output_tokens', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('settings', 'text_max_output_tokens')
