"""rename baidu_ocr_api_key to baidu_api_key

Revision ID: 015
Revises: 7acf21d5e41d
Create Date: 2026-02-26

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '015'
down_revision = '7acf21d5e41d'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('settings') as batch_op:
        batch_op.alter_column('baidu_ocr_api_key', new_column_name='baidu_api_key')


def downgrade():
    with op.batch_alter_table('settings') as batch_op:
        batch_op.alter_column('baidu_api_key', new_column_name='baidu_ocr_api_key')
