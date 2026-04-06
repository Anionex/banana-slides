"""add user_id to projects, materials, user_templates

Revision ID: c1d2e3f4a5b6
Revises: b2c3d4e5f6a7, ee22f1512027
Create Date: 2026-04-06 00:00:00.000000

Merges the user-system branch (b2c3d4e5f6a7) with the main branch (ee22f1512027)
and adds user_id foreign keys for data isolation.
"""
from alembic import op
import sqlalchemy as sa

revision = 'c1d2e3f4a5b6'
down_revision = ('b2c3d4e5f6a7', 'ee22f1512027')
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('projects') as batch_op:
        batch_op.add_column(sa.Column('user_id', sa.Integer(), nullable=True))

    with op.batch_alter_table('materials') as batch_op:
        batch_op.add_column(sa.Column('user_id', sa.Integer(), nullable=True))

    with op.batch_alter_table('user_templates') as batch_op:
        batch_op.add_column(sa.Column('user_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('user_templates') as batch_op:
        batch_op.drop_column('user_id')

    with op.batch_alter_table('materials') as batch_op:
        batch_op.drop_column('user_id')

    with op.batch_alter_table('projects') as batch_op:
        batch_op.drop_column('user_id')
