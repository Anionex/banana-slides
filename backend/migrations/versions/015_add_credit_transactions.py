"""Add credit_transactions table

Revision ID: 015
Revises: 014
Create Date: 2026-02-04 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'credit_transactions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('operation', sa.String(50), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('balance_after', sa.Integer(), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('project_id', sa.String(36), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_credit_transactions_user_id', 'credit_transactions', ['user_id'])
    op.create_index('ix_credit_transactions_created_at', 'credit_transactions', ['created_at'])


def downgrade():
    op.drop_index('ix_credit_transactions_created_at', table_name='credit_transactions')
    op.drop_index('ix_credit_transactions_user_id', table_name='credit_transactions')
    op.drop_table('credit_transactions')
