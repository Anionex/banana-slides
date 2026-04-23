"""add runtime payment and storage config columns

Revision ID: 20260422093000
Revises: 63e1d3cd2a06
Create Date: 2026-04-22 09:30:00
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260422093000'
down_revision = '63e1d3cd2a06'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('system_config', schema=None) as batch_op:
        batch_op.add_column(sa.Column('default_payment_provider', sa.String(length=50), nullable=True, server_default='stripe'))
        batch_op.add_column(sa.Column('enabled_payment_providers', sa.Text(), nullable=True, server_default='["stripe"]'))
        batch_op.add_column(sa.Column('payment_provider_configs', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('storage_backend', sa.String(length=50), nullable=True, server_default='local'))
        batch_op.add_column(sa.Column('storage_provider_configs', sa.Text(), nullable=True))

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('billing_provider', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('paypal_payer_id', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('paypal_subscription_id', sa.String(length=100), nullable=True))
        batch_op.create_index('ix_users_paypal_payer_id', ['paypal_payer_id'], unique=False)


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index('ix_users_paypal_payer_id')
        batch_op.drop_column('paypal_subscription_id')
        batch_op.drop_column('paypal_payer_id')
        batch_op.drop_column('billing_provider')

    with op.batch_alter_table('system_config', schema=None) as batch_op:
        batch_op.drop_column('storage_provider_configs')
        batch_op.drop_column('storage_backend')
        batch_op.drop_column('payment_provider_configs')
        batch_op.drop_column('enabled_payment_providers')
        batch_op.drop_column('default_payment_provider')
