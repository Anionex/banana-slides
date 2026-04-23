"""add recharge orders

Revision ID: a2b3c4d5e6f7
Revises: f1e2d3c4b5a6
Create Date: 2026-04-22 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "a2b3c4d5e6f7"
down_revision = "f1e2d3c4b5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recharge_orders",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_no", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("package_id", sa.String(length=64), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("channel", sa.String(length=20), nullable=False, server_default="wechat"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("code_url", sa.Text(), nullable=True),
        sa.Column("transaction_id", sa.String(length=128), nullable=True),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.Column("expire_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_no"),
    )
    op.create_index("ix_recharge_orders_order_no", "recharge_orders", ["order_no"])
    op.create_index("ix_recharge_orders_status", "recharge_orders", ["status"])
    op.create_index("ix_recharge_orders_transaction_id", "recharge_orders", ["transaction_id"], unique=True)
    op.create_index("ix_recharge_orders_user_id", "recharge_orders", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_recharge_orders_user_id", table_name="recharge_orders")
    op.drop_index("ix_recharge_orders_transaction_id", table_name="recharge_orders")
    op.drop_index("ix_recharge_orders_status", table_name="recharge_orders")
    op.drop_index("ix_recharge_orders_order_no", table_name="recharge_orders")
    op.drop_table("recharge_orders")
