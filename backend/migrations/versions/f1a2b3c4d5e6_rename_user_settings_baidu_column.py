"""rename user_settings baidu_ocr_api_key to baidu_api_key

Revision ID: f1a2b3c4d5e6
Revises: 63e1d3cd2a06
Create Date: 2026-03-05 08:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = '63e1d3cd2a06'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('user_settings') as batch_op:
        batch_op.alter_column('baidu_ocr_api_key', new_column_name='baidu_api_key')


def downgrade():
    with op.batch_alter_table('user_settings') as batch_op:
        batch_op.alter_column('baidu_api_key', new_column_name='baidu_ocr_api_key')
