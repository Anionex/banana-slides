"""add_system_config_and_invitation_codes

Revision ID: 1f3ab0b5a2dc
Revises: 96aec3088a1e
Create Date: 2026-02-06 01:22:28.286145

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1f3ab0b5a2dc'
down_revision = '96aec3088a1e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create system_config table
    op.create_table('system_config',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_editable_fields', sa.Text(), nullable=True),
    sa.Column('registration_bonus', sa.Integer(), nullable=True),
    sa.Column('invitation_bonus', sa.Integer(), nullable=True),
    sa.Column('max_invitation_codes', sa.Integer(), nullable=True),
    sa.Column('cost_generate_outline', sa.Integer(), nullable=True),
    sa.Column('cost_generate_description', sa.Integer(), nullable=True),
    sa.Column('cost_generate_image', sa.Integer(), nullable=True),
    sa.Column('cost_edit_image', sa.Integer(), nullable=True),
    sa.Column('cost_generate_material', sa.Integer(), nullable=True),
    sa.Column('cost_refine_outline', sa.Integer(), nullable=True),
    sa.Column('cost_refine_description', sa.Integer(), nullable=True),
    sa.Column('cost_parse_file', sa.Integer(), nullable=True),
    sa.Column('cost_export_editable', sa.Integer(), nullable=True),
    sa.Column('enable_credits_purchase', sa.Boolean(), nullable=True),
    sa.Column('enable_invitation', sa.Boolean(), nullable=True),
    sa.Column('credit_packages', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )

    # Create invitation_codes table
    op.create_table('invitation_codes',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('code', sa.String(length=16), nullable=False),
    sa.Column('inviter_id', sa.String(length=36), nullable=False),
    sa.Column('invitee_id', sa.String(length=36), nullable=True),
    sa.Column('status', sa.String(length=16), nullable=True),
    sa.Column('used_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('expires_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['invitee_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['inviter_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_invitation_codes_code'), 'invitation_codes', ['code'], unique=True)
    op.create_index(op.f('ix_invitation_codes_invitee_id'), 'invitation_codes', ['invitee_id'], unique=False)
    op.create_index(op.f('ix_invitation_codes_inviter_id'), 'invitation_codes', ['inviter_id'], unique=False)
    op.create_index(op.f('ix_invitation_codes_status'), 'invitation_codes', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_invitation_codes_status'), table_name='invitation_codes')
    op.drop_index(op.f('ix_invitation_codes_inviter_id'), table_name='invitation_codes')
    op.drop_index(op.f('ix_invitation_codes_invitee_id'), table_name='invitation_codes')
    op.drop_index(op.f('ix_invitation_codes_code'), table_name='invitation_codes')
    op.drop_table('invitation_codes')
    op.drop_table('system_config')
