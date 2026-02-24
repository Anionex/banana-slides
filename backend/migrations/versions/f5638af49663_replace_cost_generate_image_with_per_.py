"""replace cost_generate_image with per-resolution columns

Revision ID: f5638af49663
Revises: 79583aae33e1
Create Date: 2026-02-23 22:41:32.649799

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f5638af49663'
down_revision = '79583aae33e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add per-resolution image cost columns
    op.add_column('system_config', sa.Column('cost_generate_image_1k', sa.Integer(), nullable=True))
    op.add_column('system_config', sa.Column('cost_generate_image_2k', sa.Integer(), nullable=True))
    op.add_column('system_config', sa.Column('cost_generate_image_4k', sa.Integer(), nullable=True))

    # Migrate existing cost_generate_image value to cost_generate_image_2k
    op.execute("UPDATE system_config SET cost_generate_image_2k = cost_generate_image WHERE cost_generate_image IS NOT NULL")
    # Set defaults for all resolution columns
    op.execute("UPDATE system_config SET cost_generate_image_2k = 8 WHERE cost_generate_image_2k IS NULL")
    op.execute("UPDATE system_config SET cost_generate_image_1k = 4 WHERE cost_generate_image_1k IS NULL")
    op.execute("UPDATE system_config SET cost_generate_image_4k = 16 WHERE cost_generate_image_4k IS NULL")

    # Drop old column (SQLite batch mode)
    with op.batch_alter_table('system_config') as batch_op:
        batch_op.drop_column('cost_generate_image')


def downgrade() -> None:
    op.add_column('system_config', sa.Column('cost_generate_image', sa.INTEGER(), nullable=True))
    op.execute("UPDATE system_config SET cost_generate_image = cost_generate_image_2k")

    with op.batch_alter_table('system_config') as batch_op:
        batch_op.drop_column('cost_generate_image_4k')
        batch_op.drop_column('cost_generate_image_2k')
        batch_op.drop_column('cost_generate_image_1k')
