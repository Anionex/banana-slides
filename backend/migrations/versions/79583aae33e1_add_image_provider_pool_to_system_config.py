"""add_image_provider_pool_to_system_config

Revision ID: 79583aae33e1
Revises: 1f3ab0b5a2dc
Create Date: 2026-02-23 12:58:44.206041

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '79583aae33e1'
down_revision = '1f3ab0b5a2dc'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('system_config', sa.Column('image_provider_pool', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('system_config', 'image_provider_pool')
