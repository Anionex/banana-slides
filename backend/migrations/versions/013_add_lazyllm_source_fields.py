"""add lazyllm source fields to settings table

Revision ID: 013
Revises: 012
Create Date: 2026-02-13

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('settings', sa.Column('text_model_source', sa.String(50), nullable=True))
    op.add_column('settings', sa.Column('image_model_source', sa.String(50), nullable=True))
    op.add_column('settings', sa.Column('image_caption_model_source', sa.String(50), nullable=True))
    op.add_column('settings', sa.Column('lazyllm_api_keys', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('settings', 'lazyllm_api_keys')
    op.drop_column('settings', 'image_caption_model_source')
    op.drop_column('settings', 'image_model_source')
    op.drop_column('settings', 'text_model_source')
