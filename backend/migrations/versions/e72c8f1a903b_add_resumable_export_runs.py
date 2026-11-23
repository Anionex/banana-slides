"""Persist editable export requests and unique resume lineage.

Revision ID: e72c8f1a903b
Revises: d84c2a7f9130
"""
from alembic import op
import sqlalchemy as sa

revision = 'e72c8f1a903b'
down_revision = 'd84c2a7f9130'
branch_labels = None
depends_on = None


def upgrade():
    if 'export_runs' not in sa.inspect(op.get_bind()).get_table_names():
        op.create_table('export_runs',
            sa.Column('task_id', sa.String(36), sa.ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True),
            sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
            sa.Column('parent_task_id', sa.String(36), unique=True),
            sa.Column('request_json', sa.Text, nullable=False),
            sa.Column('request_hash', sa.String(64), nullable=False),
            sa.Column('artifact_filename', sa.String(255), nullable=False, unique=True),
            sa.Column('artifact_sha256', sa.String(64)),
            sa.Column('queue_deadline_at', sa.Float, nullable=False),
        )
        op.create_index('ix_export_runs_project_id', 'export_runs', ['project_id'])


def downgrade():
    op.drop_table('export_runs')
