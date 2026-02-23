"""add layout_presets to settings

Revision ID: 65ee53835126
Revises: 7acf21d5e41d
Create Date: 2026-02-23 18:37:37.511522

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '65ee53835126'
down_revision = '7acf21d5e41d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('settings', sa.Column('layout_presets', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('settings', 'layout_presets')
