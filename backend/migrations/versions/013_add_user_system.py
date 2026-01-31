"""Add user system for SaaS multi-tenancy

Revision ID: 013_add_user_system
Revises: 012_add_export_allow_partial_to_projects
Create Date: 2026-02-01 00:00:00.000000

This migration:
1. Creates the 'users' table
2. Creates the 'user_settings' table (per-user settings)
3. Adds 'user_id' column to projects, materials, user_templates, reference_files
4. Creates indexes for efficient user-scoped queries
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add user system tables and columns."""
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()
    
    # 1. Create users table
    if 'users' not in existing_tables:
        op.create_table('users',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=False),
            sa.Column('password_hash', sa.String(length=255), nullable=False),
            sa.Column('username', sa.String(length=100), nullable=True),
            sa.Column('avatar_url', sa.String(length=500), nullable=True),
            # Subscription
            sa.Column('subscription_plan', sa.String(length=20), nullable=False, server_default='free'),
            sa.Column('subscription_expires_at', sa.DateTime(), nullable=True),
            sa.Column('stripe_customer_id', sa.String(length=100), nullable=True),
            sa.Column('stripe_subscription_id', sa.String(length=100), nullable=True),
            # Credits (积分制)
            sa.Column('credits_balance', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('credits_used_total', sa.Integer(), nullable=False, server_default='0'),
            # Legacy quota fields (kept for backward compatibility)
            sa.Column('projects_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('storage_used_mb', sa.Float(), nullable=False, server_default='0'),
            sa.Column('ai_calls_this_month', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('ai_calls_reset_at', sa.DateTime(), nullable=True),
            # Account status
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
            sa.Column('email_verified', sa.Boolean(), nullable=False, server_default='0'),
            sa.Column('verification_token', sa.String(length=100), nullable=True),
            sa.Column('verification_token_expires', sa.DateTime(), nullable=True),
            # Password reset
            sa.Column('password_reset_token', sa.String(length=100), nullable=True),
            sa.Column('password_reset_expires', sa.DateTime(), nullable=True),
            # Timestamps
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.Column('last_login_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_users_email', 'users', ['email'], unique=True)
        op.create_index('ix_users_stripe_customer_id', 'users', ['stripe_customer_id'], unique=False)
    
    # 2. Create user_settings table
    if 'user_settings' not in existing_tables:
        op.create_table('user_settings',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('user_id', sa.String(length=36), nullable=False),
            # AI Provider settings
            sa.Column('ai_provider_format', sa.String(length=20), nullable=False, server_default='gemini'),
            sa.Column('api_base_url', sa.String(length=500), nullable=True),
            sa.Column('api_key', sa.String(length=500), nullable=True),
            # Image generation settings
            sa.Column('image_resolution', sa.String(length=20), nullable=False, server_default='2K'),
            sa.Column('image_aspect_ratio', sa.String(length=10), nullable=False, server_default='16:9'),
            # Concurrency settings
            sa.Column('max_description_workers', sa.Integer(), nullable=False, server_default='5'),
            sa.Column('max_image_workers', sa.Integer(), nullable=False, server_default='8'),
            # Model settings
            sa.Column('text_model', sa.String(length=100), nullable=True),
            sa.Column('image_model', sa.String(length=100), nullable=True),
            sa.Column('image_caption_model', sa.String(length=100), nullable=True),
            # MinerU settings
            sa.Column('mineru_api_base', sa.String(length=255), nullable=True),
            sa.Column('mineru_token', sa.String(length=500), nullable=True),
            # Language settings
            sa.Column('output_language', sa.String(length=10), nullable=False, server_default='zh'),
            # Reasoning mode settings
            sa.Column('enable_text_reasoning', sa.Boolean(), nullable=False, server_default='0'),
            sa.Column('text_thinking_budget', sa.Integer(), nullable=False, server_default='1024'),
            sa.Column('enable_image_reasoning', sa.Boolean(), nullable=False, server_default='0'),
            sa.Column('image_thinking_budget', sa.Integer(), nullable=False, server_default='1024'),
            # Third-party API keys
            sa.Column('baidu_ocr_api_key', sa.String(length=500), nullable=True),
            # Timestamps
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id')
        )
        op.create_index('ix_user_settings_user_id', 'user_settings', ['user_id'], unique=True)
    
    # 3. Add user_id to existing tables
    # For projects table
    if 'projects' in existing_tables:
        columns = [col['name'] for col in inspector.get_columns('projects')]
        if 'user_id' not in columns:
            # Add column as nullable first (for existing data)
            op.add_column('projects', sa.Column('user_id', sa.String(length=36), nullable=True))
            op.create_index('ix_projects_user_id', 'projects', ['user_id'], unique=False)
            op.create_index('ix_projects_user_updated', 'projects', ['user_id', 'updated_at'], unique=False)
    
    # For materials table
    if 'materials' in existing_tables:
        columns = [col['name'] for col in inspector.get_columns('materials')]
        if 'user_id' not in columns:
            op.add_column('materials', sa.Column('user_id', sa.String(length=36), nullable=True))
            op.create_index('ix_materials_user_id', 'materials', ['user_id'], unique=False)
    
    # For user_templates table
    if 'user_templates' in existing_tables:
        columns = [col['name'] for col in inspector.get_columns('user_templates')]
        if 'user_id' not in columns:
            op.add_column('user_templates', sa.Column('user_id', sa.String(length=36), nullable=True))
            op.create_index('ix_user_templates_user_id', 'user_templates', ['user_id'], unique=False)
    
    # For reference_files table
    if 'reference_files' in existing_tables:
        columns = [col['name'] for col in inspector.get_columns('reference_files')]
        if 'user_id' not in columns:
            op.add_column('reference_files', sa.Column('user_id', sa.String(length=36), nullable=True))
            op.create_index('ix_reference_files_user_id', 'reference_files', ['user_id'], unique=False)


def downgrade() -> None:
    """Remove user system tables and columns."""
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()
    
    # Remove user_id columns from existing tables
    if 'reference_files' in existing_tables:
        columns = [col['name'] for col in inspector.get_columns('reference_files')]
        if 'user_id' in columns:
            op.drop_index('ix_reference_files_user_id', table_name='reference_files')
            op.drop_column('reference_files', 'user_id')
    
    if 'user_templates' in existing_tables:
        columns = [col['name'] for col in inspector.get_columns('user_templates')]
        if 'user_id' in columns:
            op.drop_index('ix_user_templates_user_id', table_name='user_templates')
            op.drop_column('user_templates', 'user_id')
    
    if 'materials' in existing_tables:
        columns = [col['name'] for col in inspector.get_columns('materials')]
        if 'user_id' in columns:
            op.drop_index('ix_materials_user_id', table_name='materials')
            op.drop_column('materials', 'user_id')
    
    if 'projects' in existing_tables:
        columns = [col['name'] for col in inspector.get_columns('projects')]
        if 'user_id' in columns:
            op.drop_index('ix_projects_user_updated', table_name='projects')
            op.drop_index('ix_projects_user_id', table_name='projects')
            op.drop_column('projects', 'user_id')
    
    # Drop user_settings table
    if 'user_settings' in existing_tables:
        op.drop_index('ix_user_settings_user_id', table_name='user_settings')
        op.drop_table('user_settings')
    
    # Drop users table
    if 'users' in existing_tables:
        op.drop_index('ix_users_stripe_customer_id', table_name='users')
        op.drop_index('ix_users_email', table_name='users')
        op.drop_table('users')
