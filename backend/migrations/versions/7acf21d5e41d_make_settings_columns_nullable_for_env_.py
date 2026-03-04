"""make settings columns nullable for env fallback

Revision ID: 7acf21d5e41d
Revises: 6f0b2879a67c
Create Date: 2026-02-23 14:22:40.719334

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7acf21d5e41d'
down_revision = '6f0b2879a67c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('settings') as batch_op:
        batch_op.alter_column('ai_provider_format',
                   existing_type=sa.VARCHAR(length=20), nullable=True)
        batch_op.alter_column('image_resolution',
                   existing_type=sa.VARCHAR(length=20), nullable=True)
        batch_op.alter_column('image_aspect_ratio',
                   existing_type=sa.VARCHAR(length=10), nullable=True)
        batch_op.alter_column('max_description_workers',
                   existing_type=sa.INTEGER(), nullable=True)
        batch_op.alter_column('max_image_workers',
                   existing_type=sa.INTEGER(), nullable=True)
        batch_op.alter_column('output_language',
                   existing_type=sa.VARCHAR(length=10), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table('settings') as batch_op:
        batch_op.alter_column('output_language',
                   existing_type=sa.VARCHAR(length=10), nullable=False)
        batch_op.alter_column('max_image_workers',
                   existing_type=sa.INTEGER(), nullable=False)
        batch_op.alter_column('max_description_workers',
                   existing_type=sa.INTEGER(), nullable=False)
        batch_op.alter_column('image_aspect_ratio',
                   existing_type=sa.VARCHAR(length=10), nullable=False)
        batch_op.alter_column('image_resolution',
                   existing_type=sa.VARCHAR(length=20), nullable=False)
        batch_op.alter_column('ai_provider_format',
                   existing_type=sa.VARCHAR(length=20), nullable=False)



