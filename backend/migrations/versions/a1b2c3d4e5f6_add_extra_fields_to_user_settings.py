"""add extra fields to user_settings

Revision ID: a1b2c3d4e5f6
Revises: e9497111fcaf
Create Date: 2026-03-05 07:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'e9497111fcaf'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add description generation fields
    op.add_column('user_settings', sa.Column('description_generation_mode', sa.String(20), nullable=True))
    op.add_column('user_settings', sa.Column('description_extra_fields', sa.Text(), nullable=True))
    op.add_column('user_settings', sa.Column('image_prompt_extra_fields', sa.Text(), nullable=True))

    # Add per-model provider source fields
    op.add_column('user_settings', sa.Column('text_model_source', sa.String(50), nullable=True))
    op.add_column('user_settings', sa.Column('image_model_source', sa.String(50), nullable=True))
    op.add_column('user_settings', sa.Column('image_caption_model_source', sa.String(50), nullable=True))

    # Add per-model API credential fields
    op.add_column('user_settings', sa.Column('text_api_key', sa.String(500), nullable=True))
    op.add_column('user_settings', sa.Column('text_api_base_url', sa.String(500), nullable=True))
    op.add_column('user_settings', sa.Column('image_api_key', sa.String(500), nullable=True))
    op.add_column('user_settings', sa.Column('image_api_base_url', sa.String(500), nullable=True))
    op.add_column('user_settings', sa.Column('image_caption_api_key', sa.String(500), nullable=True))
    op.add_column('user_settings', sa.Column('image_caption_api_base_url', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('user_settings', 'image_caption_api_base_url')
    op.drop_column('user_settings', 'image_caption_api_key')
    op.drop_column('user_settings', 'image_api_base_url')
    op.drop_column('user_settings', 'image_api_key')
    op.drop_column('user_settings', 'text_api_base_url')
    op.drop_column('user_settings', 'text_api_key')
    op.drop_column('user_settings', 'image_caption_model_source')
    op.drop_column('user_settings', 'image_model_source')
    op.drop_column('user_settings', 'text_model_source')
    op.drop_column('user_settings', 'image_prompt_extra_fields')
    op.drop_column('user_settings', 'description_extra_fields')
    op.drop_column('user_settings', 'description_generation_mode')
