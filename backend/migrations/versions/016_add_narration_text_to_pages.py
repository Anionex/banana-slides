"""add narration_text to pages

Revision ID: 016_add_narration_text_to_pages
Revises: 9ad736fec43d
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '016_add_narration_text_to_pages'
down_revision = '9ad736fec43d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('pages', sa.Column('narration_text', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('pages', 'narration_text')
