"""Make user_settings a sparse override table

Revision ID: 017_sparse_user_settings
Revises: 1f3ab0b5a2dc
Create Date: 2026-03-30 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '017_sparse_user_settings'
down_revision = '1f3ab0b5a2dc'
branch_labels = None
depends_on = None


_OVERRIDE_COLUMNS = [
    ('ai_provider_format', sa.String(length=20), 'gemini'),
    ('api_base_url', sa.String(length=500), None),
    ('api_key', sa.String(length=500), None),
    ('image_resolution', sa.String(length=20), '2K'),
    ('image_aspect_ratio', sa.String(length=10), '16:9'),
    ('max_description_workers', sa.Integer(), '5'),
    ('max_image_workers', sa.Integer(), '8'),
    ('text_model', sa.String(length=100), None),
    ('image_model', sa.String(length=100), None),
    ('image_caption_model', sa.String(length=100), None),
    ('mineru_api_base', sa.String(length=255), None),
    ('mineru_token', sa.String(length=500), None),
    ('output_language', sa.String(length=10), 'zh'),
    ('enable_text_reasoning', sa.Boolean(), '0'),
    ('text_thinking_budget', sa.Integer(), '1024'),
    ('enable_image_reasoning', sa.Boolean(), '0'),
    ('image_thinking_budget', sa.Integer(), '1024'),
    ('baidu_ocr_api_key', sa.String(length=500), None),
]


def upgrade() -> None:
    with op.batch_alter_table('user_settings') as batch_op:
        for column_name, column_type, _old_default in _OVERRIDE_COLUMNS:
            batch_op.alter_column(
                column_name,
                existing_type=column_type,
                nullable=True,
                server_default=None,
            )


def downgrade() -> None:
    defaults = {
        'ai_provider_format': 'gemini',
        'image_resolution': '2K',
        'image_aspect_ratio': '16:9',
        'max_description_workers': 5,
        'max_image_workers': 8,
        'output_language': 'zh',
        'enable_text_reasoning': False,
        'text_thinking_budget': 1024,
        'enable_image_reasoning': False,
        'image_thinking_budget': 1024,
    }

    for column_name, default_value in defaults.items():
        op.execute(
            sa.text(f"UPDATE user_settings SET {column_name} = :value WHERE {column_name} IS NULL")
            .bindparams(value=default_value)
        )

    with op.batch_alter_table('user_settings') as batch_op:
        for column_name, column_type, old_default in _OVERRIDE_COLUMNS:
            batch_op.alter_column(
                column_name,
                existing_type=column_type,
                nullable=(old_default is None),
                server_default=old_default,
            )
