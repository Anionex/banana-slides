#!/app/.venv/bin/python
"""Fail unless the configured database matches this image's schema contract."""

import os
import sys
from pathlib import Path

from sqlalchemy import create_engine

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR / 'backend'))

from migrations.url_config import select_database_url
from schema_compatibility import inspect_schema


database_url = select_database_url(os.getenv('DATABASE_URL'), None)
result = inspect_schema(
    create_engine(database_url, pool_pre_ping=True),
    ROOT_DIR / 'backend' / 'migrations',
)
if not result.compatible:
    print(
        'Banana schema mismatch: '
        f'current={result.current_revisions or ("missing",)} '
        f'expected={result.expected_revisions} '
        f'missing_columns={result.missing_columns or ("none",)} '
        f'invalid_columns={result.invalid_columns or ("none",)}',
        file=sys.stderr,
    )
    raise SystemExit(1)
print(f'Banana schema verified: revisions={result.current_revisions}')
