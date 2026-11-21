"""add template_style to projects

Revision ID: 004_add_template_style
Revises: 38292967f3ca
Create Date: 2025-12-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '004_add_template_style'
down_revision = '38292967f3ca'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    """
    Add template_style field to projects table.
    This field stores the style description when user chooses template-free mode.
    """
    # Add template_style column (nullable, defaults to None)
    if not _column_exists('projects', 'template_style'):
        op.add_column('projects', sa.Column('template_style', sa.Text(), nullable=True))


def downgrade() -> None:
    """
    Remove template_style field from projects table.
    """
    if _column_exists('projects', 'template_style'):
        op.drop_column('projects', 'template_style')
