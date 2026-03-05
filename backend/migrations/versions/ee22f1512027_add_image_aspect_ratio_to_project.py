"""add image_aspect_ratio to project

Revision ID: ee22f1512027
Revises: 013
Create Date: 2026-02-14 01:58:15.948064

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ee22f1512027'
down_revision = '013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('image_aspect_ratio', sa.String(length=10), server_default='16:9', nullable=False))


def downgrade() -> None:
    op.drop_column('projects', 'image_aspect_ratio')
