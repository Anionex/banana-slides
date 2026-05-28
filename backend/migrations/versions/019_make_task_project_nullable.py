"""make task project nullable

Revision ID: 019_make_task_project_nullable
Revises: 018_add_project_title
Create Date: 2026-05-28
"""

from alembic import op
import sqlalchemy as sa


revision = '019_make_task_project_nullable'
down_revision = '018_add_project_title'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('tasks', schema=None) as batch_op:
        batch_op.alter_column(
            'project_id',
            existing_type=sa.String(length=36),
            nullable=True,
        )


def downgrade():
    with op.batch_alter_table('tasks', schema=None) as batch_op:
        batch_op.alter_column(
            'project_id',
            existing_type=sa.String(length=36),
            nullable=False,
        )
