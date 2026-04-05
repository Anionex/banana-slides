"""add feiye user system tables (new design)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-05 00:00:00.000000

This migration is a no-op stub that bridges the old 016_user_account_billing
revision (deployed on the Tencent server) to our new user system tables.
The new tables (users, sms_codes, subscriptions, points_transactions) are
created by migration a1b2c3d4e5f6 which runs first on fresh installs.
On the production server the old tables already exist under different names,
so we just stamp the version and let the app use the new models.
"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No-op: tables already created by a1b2c3d4e5f6 on fresh installs.
    # On the production server this migration is never reached because
    # the DB is stamped at 016_user_account_billing and we bridge below.
    pass


def downgrade() -> None:
    pass
