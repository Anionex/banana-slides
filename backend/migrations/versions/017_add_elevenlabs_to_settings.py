"""add elevenlabs settings

Revision ID: 017_add_elevenlabs_to_settings
Revises: 416cd372ad39
Create Date: 2026-05-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = '017_add_elevenlabs_to_settings'
down_revision = '416cd372ad39'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    if not _column_exists('settings', 'elevenlabs_enabled'):
        op.add_column('settings', sa.Column('elevenlabs_enabled', sa.Boolean(), nullable=False, server_default='0'))
    if not _column_exists('settings', 'elevenlabs_api_key'):
        op.add_column('settings', sa.Column('elevenlabs_api_key', sa.String(500), nullable=True))
    if not _column_exists('settings', 'elevenlabs_voice_id'):
        op.add_column('settings', sa.Column('elevenlabs_voice_id', sa.String(100), nullable=True))


def downgrade() -> None:
    if _column_exists('settings', 'elevenlabs_voice_id'):
        op.drop_column('settings', 'elevenlabs_voice_id')
    if _column_exists('settings', 'elevenlabs_api_key'):
        op.drop_column('settings', 'elevenlabs_api_key')
    if _column_exists('settings', 'elevenlabs_enabled'):
        op.drop_column('settings', 'elevenlabs_enabled')
