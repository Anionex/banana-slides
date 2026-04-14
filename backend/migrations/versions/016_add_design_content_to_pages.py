"""add design_content to pages

Revision ID: 016_add_design_content
Revises: c153f8c4e111
Create Date: 2026-04-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '016_add_design_content'
down_revision = 'c153f8c4e111'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('pages', sa.Column('design_content', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('pages', 'design_content')
