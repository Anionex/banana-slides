"""add platform submission receipts

Revision ID: 020_platform_receipts
Revises: 78475bbce762
"""
from alembic import op
import sqlalchemy as sa


revision = '020_platform_receipts'
down_revision = '78475bbce762'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'platform_submission_receipts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('platform_project_id', sa.BigInteger(), nullable=False),
        sa.Column('platform_job_id', sa.BigInteger(), nullable=True),
        sa.Column('external_project_id', sa.String(length=36), nullable=True),
        sa.Column('operation', sa.String(length=64), nullable=False),
        sa.Column('idempotency_key', sa.String(length=191), nullable=False),
        sa.Column('request_hash', sa.String(length=64), nullable=False),
        sa.Column('current_task_id', sa.String(length=36), nullable=True),
        sa.Column('attempt_no', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='PENDING'),
        sa.Column('error_code', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('idempotency_key', name='uk_platform_submission_idempotency'),
    )
    op.create_index('idx_platform_submission_project', 'platform_submission_receipts', ['platform_project_id'])
    op.create_index('idx_platform_submission_job', 'platform_submission_receipts', ['platform_job_id'])
    op.create_index('idx_platform_submission_external_project', 'platform_submission_receipts', ['external_project_id'])
    op.create_index('idx_platform_submission_task', 'platform_submission_receipts', ['current_task_id'])


def downgrade():
    op.drop_table('platform_submission_receipts')
