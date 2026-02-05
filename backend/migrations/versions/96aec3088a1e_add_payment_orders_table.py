"""add_payment_orders_table

Revision ID: 96aec3088a1e
Revises: 016
Create Date: 2026-02-05 15:20:36.734461

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '96aec3088a1e'
down_revision = '016'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create payment_orders table for order auditing
    op.create_table('payment_orders',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('package_id', sa.String(length=50), nullable=False),
        sa.Column('package_name', sa.String(length=100), nullable=False),
        sa.Column('credits', sa.Integer(), nullable=False),
        sa.Column('bonus_credits', sa.Integer(), nullable=True, default=0),
        sa.Column('total_credits', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=True, default='CNY'),
        sa.Column('payment_provider', sa.String(length=50), nullable=False),
        sa.Column('payment_type', sa.String(length=20), nullable=True),
        sa.Column('external_order_id', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True, default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payment_orders_created_at'), 'payment_orders', ['created_at'], unique=False)
    op.create_index(op.f('ix_payment_orders_external_order_id'), 'payment_orders', ['external_order_id'], unique=False)
    op.create_index(op.f('ix_payment_orders_status'), 'payment_orders', ['status'], unique=False)
    op.create_index(op.f('ix_payment_orders_user_id'), 'payment_orders', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_payment_orders_user_id'), table_name='payment_orders')
    op.drop_index(op.f('ix_payment_orders_status'), table_name='payment_orders')
    op.drop_index(op.f('ix_payment_orders_external_order_id'), table_name='payment_orders')
    op.drop_index(op.f('ix_payment_orders_created_at'), table_name='payment_orders')
    op.drop_table('payment_orders')
