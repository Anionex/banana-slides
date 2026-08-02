"""add per-page template system

Revision ID: 019_per_page_template
Revises: 018_add_project_title
Create Date: 2026-06-23
"""

import logging
import os
import uuid
from datetime import datetime
from pathlib import Path

from alembic import op
import sqlalchemy as sa


revision = '019_per_page_template'
down_revision = '018_add_project_title'
branch_labels = None
depends_on = None


logger = logging.getLogger(__name__)


def upgrade():
    # 1. projects.template_mode
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'template_mode',
                sa.String(length=10),
                nullable=False,
                server_default='single',
            )
        )

    # 2. project_template_assets table
    op.create_table(
        'project_template_assets',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('project_id', sa.String(length=36), nullable=False),
        sa.Column('image_path', sa.String(length=500), nullable=False),
        sa.Column('thumb_path', sa.String(length=500), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('source', sa.String(length=20), nullable=False, server_default='upload'),
        sa.Column('source_pdf_id', sa.String(length=36), nullable=True),
        sa.Column('source_page_index', sa.Integer(), nullable=True),
        sa.Column('analysis_status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('analysis_json', sa.Text(), nullable=True),
        sa.Column('analysis_notes', sa.Text(), nullable=True),
        sa.Column('analysis_error', sa.Text(), nullable=True),
        sa.Column('user_label', sa.String(length=200), nullable=True),
        sa.Column('user_edited_analysis', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    )
    op.create_index(
        'ix_project_template_assets_project_id',
        'project_template_assets',
        ['project_id'],
    )

    # 3. pages 5 columns
    with op.batch_alter_table('pages', schema=None) as batch_op:
        batch_op.add_column(sa.Column('template_asset_id', sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column('template_style_text', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('template_selection_source', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('template_match_reason', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('template_match_confidence', sa.Float(), nullable=True))
        batch_op.create_foreign_key(
            'fk_pages_template_asset_id',
            'project_template_assets',
            ['template_asset_id'],
            ['id'],
            ondelete='SET NULL',
        )
        batch_op.create_index('ix_pages_template_asset_id', ['template_asset_id'])

    # 4. Backfill: for projects with existing project-level template, create one
    # ProjectTemplateAsset and link all pages; copy template_style → page.template_style_text.
    bind = op.get_bind()
    upload_root = os.environ.get('UPLOAD_FOLDER') or str(
        Path(__file__).resolve().parents[3] / 'uploads'
    )

    projects = bind.execute(
        sa.text(
            'SELECT id, template_image_path, template_style FROM projects '
            'WHERE template_image_path IS NOT NULL OR template_style IS NOT NULL'
        )
    ).fetchall()

    now = datetime.utcnow()
    for proj_id, tpl_image_path, tpl_style in projects:
        asset_id = None
        if tpl_image_path:
            absolute = (
                tpl_image_path
                if os.path.isabs(tpl_image_path)
                else os.path.join(upload_root, tpl_image_path)
            )
            if os.path.exists(absolute):
                asset_id = str(uuid.uuid4())
                bind.execute(
                    sa.text(
                        'INSERT INTO project_template_assets '
                        '(id, project_id, image_path, source, analysis_status, '
                        ' user_edited_analysis, sort_order, created_at, updated_at) '
                        'VALUES (:id, :pid, :ipath, :src, :st, 0, 0, :ts, :ts)'
                    ),
                    {
                        'id': asset_id,
                        'pid': proj_id,
                        'ipath': tpl_image_path,
                        'src': 'upload',
                        'st': 'pending',
                        'ts': now,
                    },
                )
            else:
                logger.warning(
                    'Migration 019: project %s template_image_path %s missing on disk; '
                    'skipping asset creation.',
                    proj_id,
                    tpl_image_path,
                )

        if asset_id or tpl_style:
            bind.execute(
                sa.text(
                    'UPDATE pages SET '
                    '  template_asset_id = COALESCE(:asset_id, template_asset_id), '
                    '  template_style_text = COALESCE(:style_text, template_style_text), '
                    '  template_selection_source = :src '
                    'WHERE project_id = :pid'
                ),
                {
                    'asset_id': asset_id,
                    'style_text': tpl_style,
                    'src': 'batch_apply',
                    'pid': proj_id,
                },
            )


def downgrade():
    with op.batch_alter_table('pages', schema=None) as batch_op:
        batch_op.drop_index('ix_pages_template_asset_id')
        batch_op.drop_constraint('fk_pages_template_asset_id', type_='foreignkey')
        batch_op.drop_column('template_match_confidence')
        batch_op.drop_column('template_match_reason')
        batch_op.drop_column('template_selection_source')
        batch_op.drop_column('template_style_text')
        batch_op.drop_column('template_asset_id')

    op.drop_index('ix_project_template_assets_project_id', table_name='project_template_assets')
    op.drop_table('project_template_assets')

    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.drop_column('template_mode')
