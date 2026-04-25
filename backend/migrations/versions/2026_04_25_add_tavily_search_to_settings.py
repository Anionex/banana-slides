"""add tavily web search fields to settings

Revision ID: 2026_04_25_add_tavily_search
Revises: c153f8c4e111
Create Date: 2026-04-25 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2026_04_25_add_tavily_search'
down_revision = 'c153f8c4e111'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('settings', sa.Column('enable_web_search', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('settings', sa.Column('web_search_max_results', sa.Integer(), nullable=False, server_default=sa.text('5')))
    op.add_column('settings', sa.Column('tavily_api_key', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('settings', 'tavily_api_key')
    op.drop_column('settings', 'web_search_max_results')
    op.drop_column('settings', 'enable_web_search')
