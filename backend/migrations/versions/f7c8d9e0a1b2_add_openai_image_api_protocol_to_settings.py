"""add openai image api protocol to settings

Revision ID: f7c8d9e0a1b2
Revises: f6b7c8d9e0f1
Create Date: 2026-05-08 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "f7c8d9e0a1b2"
down_revision = "f6b7c8d9e0f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("settings") as batch_op:
        batch_op.add_column(
            sa.Column("openai_image_api_protocol", sa.String(length=10), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("settings") as batch_op:
        batch_op.drop_column("openai_image_api_protocol")
