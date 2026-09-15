"""Add isolated public-demo visitor settings.

Revision ID: public_demo_visitors
Revises: 78475bbce762
"""
from alembic import op
import sqlalchemy as sa
revision = 'public_demo_visitors'
down_revision = '78475bbce762'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('public_visitors',
                    sa.Column('token_hash', sa.String(64), primary_key=True),
                    sa.Column('config_json', sa.Text(), nullable=False))


def downgrade():
    op.drop_table('public_visitors')
