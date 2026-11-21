"""merge heads

Revision ID: 819293cce08c
Revises: 016_add_narration_text_to_pages, 267dcee7b580
Create Date: 2026-04-27 02:39:11.654275

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '819293cce08c'
down_revision = ('016_add_narration_text_to_pages', '267dcee7b580')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass



