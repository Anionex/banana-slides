"""add user_id to reference_files

Revision ID: a7b8c9d0e1f2
Revises: f6b7c8d9e0f1
Create Date: 2026-04-24 15:55:00
"""

from alembic import op
import sqlalchemy as sa


revision = "a7b8c9d0e1f2"
down_revision = "f6b7c8d9e0f1"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("reference_files", schema=None) as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            "fk_reference_files_user_id_users",
            "users",
            ["user_id"],
            ["id"],
        )

    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE reference_files
            SET user_id = (
                SELECT projects.owner_user_id
                FROM projects
                WHERE projects.id = reference_files.project_id
            )
            WHERE project_id IS NOT NULL
            """
        )
    )


def downgrade():
    with op.batch_alter_table("reference_files", schema=None) as batch_op:
        batch_op.drop_constraint("fk_reference_files_user_id_users", type_="foreignkey")
        batch_op.drop_column("user_id")
