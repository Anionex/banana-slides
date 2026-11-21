"""rename baidu_ocr_api_key to baidu_api_key

Revision ID: 015
Revises: 7acf21d5e41d
Create Date: 2026-02-26

"""
from alembic import op
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '015'
down_revision = '7acf21d5e41d'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade():
    if _column_exists('settings', 'baidu_ocr_api_key') and not _column_exists('settings', 'baidu_api_key'):
        with op.batch_alter_table('settings') as batch_op:
            batch_op.alter_column('baidu_ocr_api_key', new_column_name='baidu_api_key')


def downgrade():
    if _column_exists('settings', 'baidu_api_key') and not _column_exists('settings', 'baidu_ocr_api_key'):
        with op.batch_alter_table('settings') as batch_op:
            batch_op.alter_column('baidu_api_key', new_column_name='baidu_ocr_api_key')
