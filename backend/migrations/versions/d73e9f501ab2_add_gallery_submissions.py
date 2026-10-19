"""Store private gallery PDF submissions."""
from alembic import op
import sqlalchemy as sa

revision = 'd73e9f501ab2'
down_revision = 'c62f8e4d19a0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('gallery_submission',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('visitor_hash', sa.String(64), nullable=False),
        sa.Column('sha256', sa.String(64), nullable=False),
        sa.Column('filename', sa.String(240), nullable=False),
        sa.Column('page_count', sa.Integer(), nullable=False),
        sa.Column('byte_size', sa.Integer(), nullable=False),
        sa.Column('metadata_json', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('visitor_hash', 'sha256', name='uq_submission_visitor_pdf'))
    op.create_index('ix_gallery_submission_visitor_hash', 'gallery_submission', ['visitor_hash'])
    op.create_index('ix_gallery_submission_created_at', 'gallery_submission', ['created_at'])


def downgrade():
    op.drop_table('gallery_submission')
