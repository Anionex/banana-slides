"""merge opensource and saas migration branches

Revision ID: 6862bd89f1f1
Revises: 62911f1e9598, 88054bda1ece
Create Date: 2026-03-05 02:37:00.934325

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6862bd89f1f1'
down_revision = ('62911f1e9598', '88054bda1ece')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass



