"""Add the hosted beta invitation list.

Revision ID: hosted_beta_waitlist
Revises: public_demo_visitors
"""
from alembic import op
import sqlalchemy as sa

revision = 'hosted_beta_waitlist'
down_revision = 'public_demo_visitors'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'waitlist_signups',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(length=254), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    op.drop_table('waitlist_signups')
