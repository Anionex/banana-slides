"""Compatibility marker for a retired website-only migration.

Keep this revision resolvable for databases upgraded before the website features
were removed from main. Fresh installs must not create website tables; existing
user data is left untouched on both upgrade and downgrade.
"""

revision = 'public_demo_visitors'
down_revision = '78475bbce762'
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
