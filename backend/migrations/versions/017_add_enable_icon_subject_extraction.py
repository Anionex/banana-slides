"""add enable_icon_subject_extraction to projects

Revision ID: 017_icon_subject_ext
Revises: 416cd372ad39
Create Date: 2026-05-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '017_icon_subject_ext'
down_revision = '416cd372ad39'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add enable_icon_subject_extraction column to projects table.

    When enabled (default), small icon-like images extracted during editable
    PPTX export will be passed through Baidu's smart segmentation API to
    produce transparent-background PNGs. Falls back to the original rectangle
    crop on failure or when BAIDU_API_KEY is not configured.
    """
    op.add_column(
        'projects',
        sa.Column(
            'enable_icon_subject_extraction',
            sa.Boolean(),
            nullable=True,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column('projects', 'enable_icon_subject_extraction')
