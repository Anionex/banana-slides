"""merge heads

Revision ID: e6a7f776bb7e
Revises: 016_add_narration_text_to_pages, 267dcee7b580
Create Date: 2026-04-27 02:16:40.047649

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e6a7f776bb7e'
down_revision = ('016_add_narration_text_to_pages', '267dcee7b580')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass



