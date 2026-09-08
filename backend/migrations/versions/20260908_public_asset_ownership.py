"""Scope public-demo materials and reusable templates to their creator."""
from alembic import op
import sqlalchemy as sa

revision = 'public_asset_ownership'
down_revision = 'public_demo_visitors'
branch_labels = None
depends_on = None

TABLES = ('materials', 'user_templates', 'user_style_templates', 'reference_files')


def upgrade():
    for table in TABLES:
        # Legacy rows have no reliable visitor attribution; preserve them as NULL.
        inspector = sa.inspect(op.get_bind())
        if 'public_visitor_hash' not in {column['name'] for column in inspector.get_columns(table)}:
            op.add_column(table, sa.Column('public_visitor_hash', sa.String(64), nullable=True))
        index_name = 'ix_' + table + '_public_visitor_hash'
        if index_name not in {index['name'] for index in inspector.get_indexes(table)}:
            op.create_index(index_name, table, ['public_visitor_hash'])


def downgrade():
    for table in reversed(TABLES):
        op.drop_index('ix_' + table + '_public_visitor_hash', table_name=table)
        with op.batch_alter_table(table) as batch:
            batch.drop_column('public_visitor_hash')
