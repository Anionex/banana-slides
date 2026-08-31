"""add structured visual consistency artifacts

Revision ID: 022_structured_visual
Revises: 021_project_page_count
"""
from alembic import op
import sqlalchemy as sa


revision = '022_structured_visual'
down_revision = '021_project_page_count'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('projects', sa.Column(
        'generation_mode', sa.String(length=32), nullable=False,
        server_default='STANDARD_VISUAL'))
    op.add_column('projects', sa.Column('design_preferences_json', sa.Text(), nullable=True))
    op.add_column('projects', sa.Column('design_spec_json', sa.Text(), nullable=True))
    op.add_column('projects', sa.Column('design_spec_hash', sa.String(length=64), nullable=True))
    op.add_column('projects', sa.Column(
        'design_spec_version', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('projects', sa.Column('style_board_path', sa.String(length=500), nullable=True))
    op.add_column('projects', sa.Column('consistency_status', sa.String(length=32), nullable=True))
    op.add_column('projects', sa.Column('consistency_warnings_json', sa.Text(), nullable=True))
    op.add_column('pages', sa.Column('page_plan_json', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('pages', 'page_plan_json')
    for column in (
        'consistency_warnings_json', 'consistency_status', 'style_board_path',
        'design_spec_version', 'design_spec_hash', 'design_spec_json',
        'design_preferences_json', 'generation_mode',
    ):
        op.drop_column('projects', column)
