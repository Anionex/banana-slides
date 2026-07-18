"""merge quality control and per page template heads

Revision ID: 78475bbce762
Revises: 019_per_page_template, b7d8c9e4f2a1
Create Date: 2026-07-03 20:30:21.212484

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '78475bbce762'
down_revision = ('019_per_page_template', 'b7d8c9e4f2a1')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass



