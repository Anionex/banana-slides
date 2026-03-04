"""rename baidu_ocr_api_key to baidu_api_key in user_settings

Revision ID: b1234567890a
Revises: a1cb9099a491
Create Date: 2026-03-04

"""
from alembic import op
import sqlalchemy as sa


revision = 'b1234567890a'
down_revision = 'a1cb9099a491'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('user_settings') as batch_op:
        batch_op.alter_column('baidu_ocr_api_key', new_column_name='baidu_api_key')


def downgrade() -> None:
    with op.batch_alter_table('user_settings') as batch_op:
        batch_op.alter_column('baidu_api_key', new_column_name='baidu_ocr_api_key')
