"""Compatibility marker for a retired website-only migration.

Keep this revision resolvable for databases upgraded before the website features
were removed from main. Fresh installs must not create website tables; existing
user data is left untouched on both upgrade and downgrade.
"""

revision = 'c42f8e9a1b70'
down_revision = 'b82a4ddcb102'
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
