"""Store images attached to public problem reports.

Revision ID: c62f8e4d19a0
Revises: b82a4ddcb102
"""
from alembic import op
import sqlalchemy as sa

revision = 'c62f8e4d19a0'
down_revision = 'b82a4ddcb102'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'feedback_image',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('feedback_id', sa.Integer(), sa.ForeignKey('feedback.id'), nullable=False),
        sa.Column('mime_type', sa.String(length=32), nullable=False),
        sa.Column('data', sa.LargeBinary(), nullable=False),
    )
    op.create_index('ix_feedback_image_feedback_id', 'feedback_image', ['feedback_id'])


def downgrade():
    op.drop_index('ix_feedback_image_feedback_id', table_name='feedback_image')
    op.drop_table('feedback_image')
