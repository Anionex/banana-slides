"""add enable_alipay to system_config

Revision ID: 531fc60d60cc
Revises: 017_sparse_user_settings
Create Date: 2026-04-12 17:56:14.825494

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '531fc60d60cc'
down_revision = '017_sparse_user_settings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('system_config', sa.Column('enable_alipay', sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column('system_config', 'enable_alipay')
