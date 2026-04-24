"""add subscription orders and plans

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-04-22 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "c4d5e6f7a8b9"
down_revision = "b3c4d5e6f7a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("settings", sa.Column("subscription_plans", sa.Text(), nullable=True))
    op.add_column(
        "recharge_orders",
        sa.Column("order_type", sa.String(length=20), nullable=False, server_default="points"),
    )
    op.add_column("recharge_orders", sa.Column("subscription_plan", sa.String(length=20), nullable=True))
    op.create_index("ix_recharge_orders_order_type", "recharge_orders", ["order_type"])


def downgrade() -> None:
    op.drop_index("ix_recharge_orders_order_type", table_name="recharge_orders")
    op.drop_column("recharge_orders", "subscription_plan")
    op.drop_column("recharge_orders", "order_type")
    op.drop_column("settings", "subscription_plans")
