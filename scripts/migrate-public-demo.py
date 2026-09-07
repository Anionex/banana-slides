#!/usr/bin/env python3
"""Copy legacy sponsor SQLite data into a new, current-schema demo database.

Never edits the source or overwrites an existing destination. Upload files stay
in the deployment's separate uploads volume and must be backed up with the DB.
"""
import argparse
import hashlib
import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))


def migrate(source, destination):
    from sqlalchemy import create_engine, DateTime
    from models import db
    from services.public_demo import DEFAULTS
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if not source.is_file():
        raise ValueError('Source database does not exist')
    if destination.exists() or source == destination:
        raise ValueError('Destination must be a new file')
    destination.parent.mkdir(parents=True, exist_ok=True)
    original = sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)
    snapshot = sqlite3.connect(':memory:')
    original.backup(snapshot)
    original.close()
    snapshot.row_factory = sqlite3.Row
    tables = {r[0] for r in snapshot.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if not {'projects', 'pages', 'settings'} <= tables:
        raise ValueError('Not a Banana Slides database')
    columns = {r[1] for r in snapshot.execute('PRAGMA table_info(settings)')}
    if 'user_token' not in columns:
        raise ValueError('Expected a legacy sponsor database with per-user settings')
    destination.touch(mode=0o600, exist_ok=False)
    engine = create_engine('sqlite:///' + destination.as_posix())
    report = {'tables': {}, 'visitors': 0, 'source_unchanged': True}
    try:
        db.metadata.create_all(engine)
        with engine.begin() as conn:
            for table in db.metadata.sorted_tables:
                if table.name not in tables or table.name in ('settings', 'public_visitors'):
                    continue
                count = 0
                for row in snapshot.execute('SELECT * FROM "' + table.name + '"'):
                    item = {}
                    for col in table.columns:
                        if col.name in row.keys():
                            value = row[col.name]
                            if value is not None and isinstance(col.type, DateTime):
                                value = datetime.fromisoformat(value)
                            item[col.name] = value
                    conn.execute(table.insert().values(**item))
                    count += 1
                report['tables'][table.name] = count
            for row in snapshot.execute('SELECT * FROM settings'):
                old = dict(row)
                token = old.get('user_token')
                if not token:
                    raise ValueError('Legacy settings row has no visitor token')
                data = {key: old[key] for key in DEFAULTS if old.get(key) is not None}
                data['partner'] = 'inferera'
                data['provider_keys'] = {'inferera': old.get('api_key') or ''}
                data['baidu_api_key'] = old.get('baidu_ocr_api_key') or old.get('baidu_api_key') or ''
                conn.execute(db.metadata.tables['public_visitors'].insert().values(
                    token_hash=hashlib.sha256(token.encode()).hexdigest(), config_json=json.dumps(data)))
                report['visitors'] += 1
            # The complete target schema was created from current metadata, so
            # this records its actual state, rather than skipping legacy updates.
            config = Config(str(ROOT / 'backend/alembic.ini'))
            config.set_main_option('script_location', str(ROOT / 'backend/migrations'))
            heads = ScriptDirectory.from_config(config).get_heads()
            if len(heads) != 1:
                raise ValueError('Expected one current migration head')
            conn.exec_driver_sql('CREATE TABLE alembic_version (version_num VARCHAR(64) NOT NULL PRIMARY KEY)')
            conn.exec_driver_sql('INSERT INTO alembic_version VALUES (?)', (heads[0],))
            for table, count in report['tables'].items():
                actual = conn.exec_driver_sql('SELECT count(*) FROM "' + table + '"').scalar_one()
                if actual != count:
                    raise ValueError('Row count mismatch: ' + table)
            if conn.exec_driver_sql('PRAGMA integrity_check').scalar_one() != 'ok':
                raise ValueError('Database integrity check failed')
        report['status'] = 'success'
        report['destination'] = str(destination)
        return report
    except Exception:
        engine.dispose()
        destination.unlink(missing_ok=True)
        raise
    finally:
        engine.dispose()
        snapshot.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--destination', required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(migrate(args.source, args.destination), ensure_ascii=False, indent=2))
    except Exception as exc:
        message = str(exc) if isinstance(exc, ValueError) else type(exc).__name__ + ': migration failed; destination removed'
        print(json.dumps({'status': 'failed', 'error': message}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
