"""add user system config to settings

Revision ID: f5a6b7c8d9e0
Revises: d4f5e6a7b8c9
Create Date: 2026-04-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "f5a6b7c8d9e0"
down_revision = "d4f5e6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("settings", sa.Column("jwt_secret_key", sa.String(length=500), nullable=True))
    op.add_column("settings", sa.Column("admin_init_phone", sa.String(length=20), nullable=True))
    op.add_column("settings", sa.Column("admin_init_username", sa.String(length=50), nullable=True))
    op.add_column("settings", sa.Column("admin_init_password", sa.String(length=255), nullable=True))
    op.add_column("settings", sa.Column("sms_provider", sa.String(length=30), nullable=True))
    op.add_column("settings", sa.Column("sms_access_key_id", sa.String(length=255), nullable=True))
    op.add_column("settings", sa.Column("sms_access_key_secret", sa.String(length=255), nullable=True))
    op.add_column("settings", sa.Column("sms_sign_name", sa.String(length=255), nullable=True))
    op.add_column("settings", sa.Column("sms_template_code", sa.String(length=255), nullable=True))
    op.add_column("settings", sa.Column("sms_endpoint", sa.String(length=500), nullable=True))
    op.add_column("settings", sa.Column("sms_code_ttl_minutes", sa.Integer(), nullable=True))
    op.add_column("settings", sa.Column("sms_rate_limit_per_day", sa.Integer(), nullable=True))
    op.add_column("settings", sa.Column("sms_mock_code", sa.String(length=20), nullable=True))
    op.add_column("settings", sa.Column("wechat_pay_enabled", sa.Boolean(), nullable=True))
    op.add_column("settings", sa.Column("wechat_pay_mock", sa.Boolean(), nullable=True))
    op.add_column("settings", sa.Column("wechat_pay_app_id", sa.String(length=255), nullable=True))
    op.add_column("settings", sa.Column("wechat_pay_mch_id", sa.String(length=255), nullable=True))
    op.add_column("settings", sa.Column("wechat_pay_serial_no", sa.String(length=255), nullable=True))
    op.add_column("settings", sa.Column("wechat_pay_private_key", sa.Text(), nullable=True))
    op.add_column("settings", sa.Column("wechat_pay_api_v3_key", sa.String(length=255), nullable=True))
    op.add_column("settings", sa.Column("wechat_pay_gateway_url", sa.String(length=500), nullable=True))
    op.add_column("settings", sa.Column("wechat_pay_notify_url", sa.String(length=500), nullable=True))
    op.add_column("settings", sa.Column("wechat_pay_order_expire_minutes", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("settings", "wechat_pay_order_expire_minutes")
    op.drop_column("settings", "wechat_pay_notify_url")
    op.drop_column("settings", "wechat_pay_gateway_url")
    op.drop_column("settings", "wechat_pay_api_v3_key")
    op.drop_column("settings", "wechat_pay_private_key")
    op.drop_column("settings", "wechat_pay_serial_no")
    op.drop_column("settings", "wechat_pay_mch_id")
    op.drop_column("settings", "wechat_pay_app_id")
    op.drop_column("settings", "wechat_pay_mock")
    op.drop_column("settings", "wechat_pay_enabled")
    op.drop_column("settings", "sms_mock_code")
    op.drop_column("settings", "sms_rate_limit_per_day")
    op.drop_column("settings", "sms_code_ttl_minutes")
    op.drop_column("settings", "sms_endpoint")
    op.drop_column("settings", "sms_template_code")
    op.drop_column("settings", "sms_sign_name")
    op.drop_column("settings", "sms_access_key_secret")
    op.drop_column("settings", "sms_access_key_id")
    op.drop_column("settings", "sms_provider")
    op.drop_column("settings", "admin_init_password")
    op.drop_column("settings", "admin_init_username")
    op.drop_column("settings", "admin_init_phone")
    op.drop_column("settings", "jwt_secret_key")
