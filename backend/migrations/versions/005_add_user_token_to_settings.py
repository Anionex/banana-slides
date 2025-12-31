"""Add user_token to settings table for multi-user support

Revision ID: 005
Revises: 004
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add user_token field to settings table and migrate existing data."""
    # 1. Add user_token column (nullable first)
    with op.batch_alter_table('settings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('user_token', sa.String(100), nullable=True))
    
    # 2. Generate a default token for existing record (if any)
    # This ensures backward compatibility
    conn = op.get_bind()
    conn.execute(text(
        "UPDATE settings SET user_token = 'default-user' WHERE user_token IS NULL"
    ))
    
    # 3. Now make it non-nullable and add unique constraint
    with op.batch_alter_table('settings', schema=None) as batch_op:
        batch_op.alter_column('user_token', nullable=False)
        batch_op.create_unique_constraint('uq_settings_user_token', ['user_token'])
    
    # 4. Drop the old primary key constraint and recreate
    # Note: In SQLite, we need to handle this carefully
    # We'll keep id as primary key but remove the default=1 constraint logic
    # The application will handle multiple settings records now


def downgrade() -> None:
    """Remove user_token field from settings table."""
    with op.batch_alter_table('settings', schema=None) as batch_op:
        batch_op.drop_constraint('uq_settings_user_token', type_='unique')
        batch_op.drop_column('user_token')


