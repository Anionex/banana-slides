"""Store public website problem reports.

Revision ID: b82a4ddcb102
Revises: hosted_beta_waitlist
"""
from alembic import op
import sqlalchemy as sa

revision = 'b82a4ddcb102'
down_revision = 'hosted_beta_waitlist'
branch_labels = None
depends_on = None


def upgrade():
    # Public demo deployments may already have this table from an older image backport.
    if sa.inspect(op.get_bind()).has_table('feedback'):
        return
    op.create_table(
        'feedback',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('reply_email', sa.String(length=254), nullable=True),
        sa.Column('page_path', sa.String(length=300), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_feedback_created_at', 'feedback', ['created_at'])


def downgrade():
    op.drop_index('ix_feedback_created_at', table_name='feedback')
    op.drop_table('feedback')
