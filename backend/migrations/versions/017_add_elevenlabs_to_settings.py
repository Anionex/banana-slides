"""add elevenlabs settings

Revision ID: 017_add_elevenlabs_to_settings
Revises: 416cd372ad39
Create Date: 2026-05-03
"""
from alembic import op
import sqlalchemy as sa


revision = '017_add_elevenlabs_to_settings'
down_revision = '416cd372ad39'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('settings', sa.Column('elevenlabs_enabled', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('settings', sa.Column('elevenlabs_api_key', sa.String(500), nullable=True))
    op.add_column('settings', sa.Column('elevenlabs_voice_id', sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column('settings', 'elevenlabs_voice_id')
    op.drop_column('settings', 'elevenlabs_api_key')
    op.drop_column('settings', 'elevenlabs_enabled')
