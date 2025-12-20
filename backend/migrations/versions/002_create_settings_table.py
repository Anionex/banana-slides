"""create settings table

Revision ID: 002_settings
Revises: 001_baseline
Create Date: 2025-12-17 22:01:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '002_settings'
down_revision = '001_baseline'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create settings table (without new model/mineru fields).
    
    Idempotent: skips if 'settings' table already exists.
    """
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'settings' in inspector.get_table_names():
        # Settings table already exists (created by db.create_all() in an intermediate version)
        return
    
    # Create settings table with original fields only
    op.create_table('settings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('ai_provider_format', sa.String(length=20), nullable=False),
    sa.Column('api_base_url', sa.String(length=500), nullable=True),
    sa.Column('api_key', sa.String(length=500), nullable=True),
    sa.Column('image_resolution', sa.String(length=20), nullable=False),
    sa.Column('image_aspect_ratio', sa.String(length=10), nullable=False),
    sa.Column('max_description_workers', sa.Integer(), nullable=False),
    sa.Column('max_image_workers', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('settings')

