"""baseline schema - core tables only

Revision ID: 001_baseline
Revises: 
Create Date: 2025-12-17 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '001_baseline'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Baseline migration - creates only the earliest core tables.
    
    Idempotent: skips if 'projects' table already exists (old project).
    """
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'projects' in inspector.get_table_names():
        # Old project: tables already created by db.create_all(), skip
        return
    
    # New installation: create core tables (NOT including settings - it came later)
    op.create_table('projects',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('idea_prompt', sa.Text(), nullable=True),
    sa.Column('outline_text', sa.Text(), nullable=True),
    sa.Column('description_text', sa.Text(), nullable=True),
    sa.Column('extra_requirements', sa.Text(), nullable=True),
    sa.Column('creation_type', sa.String(length=20), nullable=False),
    sa.Column('template_image_path', sa.String(length=500), nullable=True),
    sa.Column('status', sa.String(length=50), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('user_templates',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=True),
    sa.Column('file_path', sa.String(length=500), nullable=False),
    sa.Column('file_size', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('materials',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('project_id', sa.String(length=36), nullable=True),
    sa.Column('filename', sa.String(length=500), nullable=False),
    sa.Column('relative_path', sa.String(length=500), nullable=False),
    sa.Column('url', sa.String(length=500), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('pages',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('project_id', sa.String(length=36), nullable=False),
    sa.Column('order_index', sa.Integer(), nullable=False),
    sa.Column('part', sa.String(length=200), nullable=True),
    sa.Column('outline_content', sa.Text(), nullable=True),
    sa.Column('description_content', sa.Text(), nullable=True),
    sa.Column('generated_image_path', sa.String(length=500), nullable=True),
    sa.Column('status', sa.String(length=50), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('reference_files',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('project_id', sa.String(length=36), nullable=True),
    sa.Column('filename', sa.String(length=500), nullable=False),
    sa.Column('file_path', sa.String(length=500), nullable=False),
    sa.Column('file_size', sa.Integer(), nullable=False),
    sa.Column('file_type', sa.String(length=50), nullable=False),
    sa.Column('parse_status', sa.String(length=50), nullable=False),
    sa.Column('markdown_content', sa.Text(), nullable=True),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('mineru_batch_id', sa.String(length=100), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('tasks',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('project_id', sa.String(length=36), nullable=False),
    sa.Column('task_type', sa.String(length=50), nullable=False),
    sa.Column('status', sa.String(length=50), nullable=False),
    sa.Column('progress', sa.Text(), nullable=True),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('page_image_versions',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('page_id', sa.String(length=36), nullable=False),
    sa.Column('image_path', sa.String(length=500), nullable=False),
    sa.Column('version_number', sa.Integer(), nullable=False),
    sa.Column('is_current', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['page_id'], ['pages.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_page_image_versions_page_id'), 'page_image_versions', ['page_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_page_image_versions_page_id'), table_name='page_image_versions')
    op.drop_table('page_image_versions')
    op.drop_table('tasks')
    op.drop_table('reference_files')
    op.drop_table('pages')
    op.drop_table('materials')
    op.drop_table('user_templates')
    op.drop_table('projects')

