"""add oidc fields to user

Revision ID: 62911f1e9598
Revises: e9497111fcaf
Create Date: 2026-03-04 15:03:13.292772

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '62911f1e9598'
down_revision = 'e9497111fcaf'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add OIDC fields
    op.add_column('users', sa.Column('oidc_provider', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('oidc_sub', sa.String(length=255), nullable=True))

    # Make password_hash nullable (for OIDC users)
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column('password_hash',
                   existing_type=sa.VARCHAR(length=255),
                   nullable=True)

    # Create unique index for OIDC provider + sub
    op.create_index('idx_oidc_provider_sub', 'users', ['oidc_provider', 'oidc_sub'], unique=True)


def downgrade() -> None:
    # Remove OIDC index and fields
    op.drop_index('idx_oidc_provider_sub', table_name='users')
    op.drop_column('users', 'oidc_sub')
    op.drop_column('users', 'oidc_provider')

    # Delete OIDC users before reverting password_hash to NOT NULL
    op.execute("DELETE FROM users WHERE password_hash IS NULL AND oidc_provider IS NOT NULL")

    # Revert password_hash to NOT NULL
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column('password_hash',
                   existing_type=sa.VARCHAR(length=255),
                   nullable=False)



