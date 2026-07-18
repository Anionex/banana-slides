"""add project_title to projects

Revision ID: 018_add_project_title
Revises: 017_icon_subject_ext
Create Date: 2026-05-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = '018_add_project_title'
down_revision = '017_icon_subject_ext'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade():
    if not _column_exists('projects', 'project_title'):
        with op.batch_alter_table('projects', schema=None) as batch_op:
            batch_op.add_column(sa.Column('project_title', sa.String(length=255), nullable=True))


def downgrade():
    if _column_exists('projects', 'project_title'):
        with op.batch_alter_table('projects', schema=None) as batch_op:
            batch_op.drop_column('project_title')
