"""add owner_user_id to settings

Revision ID: e6f7a8b9c0d1
Revises: d4f5e6a7b8c9
Create Date: 2026-04-13 11:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e6f7a8b9c0d1"
down_revision = "d4f5e6a7b8c9"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("settings", schema=None) as batch_op:
        batch_op.add_column(sa.Column("owner_user_id", sa.Integer(), nullable=True))
        batch_op.create_index(
            batch_op.f("ix_settings_owner_user_id"), ["owner_user_id"], unique=True
        )
        batch_op.create_foreign_key(
            "fk_settings_owner_user_id_users", "users", ["owner_user_id"], ["id"]
        )


def downgrade():
    with op.batch_alter_table("settings", schema=None) as batch_op:
        batch_op.drop_constraint("fk_settings_owner_user_id_users", type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_settings_owner_user_id"))
        batch_op.drop_column("owner_user_id")
