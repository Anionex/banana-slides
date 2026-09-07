import importlib.util
import json
import sqlite3
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('migrate_public_demo', ROOT / 'scripts/migrate-public-demo.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_legacy_copy_preserves_project_ids_and_separates_keys(tmp_path):
    old = tmp_path / 'legacy.db'
    new = tmp_path / 'current.db'
    with sqlite3.connect(old) as conn:
        conn.executescript('''
            CREATE TABLE projects (id TEXT PRIMARY KEY, creation_type TEXT, idea_prompt TEXT, status TEXT);
            INSERT INTO projects VALUES ('old-project-link', 'idea', 'Existing presentation', 'DRAFT');
            CREATE TABLE pages (id TEXT PRIMARY KEY, project_id TEXT, order_index INTEGER, outline_content TEXT, status TEXT);
            INSERT INTO pages VALUES ('old-page', 'old-project-link', 0, '{"title":"Existing page"}', 'DRAFT');
            CREATE TABLE settings (id INTEGER PRIMARY KEY, user_token TEXT, api_key TEXT, baidu_ocr_api_key TEXT);
            INSERT INTO settings VALUES (1, 'legacy-visitor-00000000000001', 'first-private-key', 'old-ocr-key');
            INSERT INTO settings VALUES (2, 'legacy-visitor-00000000000002', 'second-private-key', '');
            CREATE TABLE alembic_version (version_num TEXT);
            INSERT INTO alembic_version VALUES ('014');
        ''')
    before = old.read_bytes()
    report = module.migrate(old, new)
    assert report['status'] == 'success'
    assert report['visitors'] == 2
    assert report['tables']['projects'] == 1
    assert old.read_bytes() == before
    with sqlite3.connect(new) as conn:
        assert conn.execute('SELECT id FROM projects').fetchone()[0] == 'old-project-link'
        assert conn.execute('SELECT count(*) FROM settings').fetchone()[0] == 0
        visitors = [json.loads(row[0]) for row in conn.execute('SELECT config_json FROM public_visitors')]
        assert {v['provider_keys']['inferera'] for v in visitors} == {'first-private-key', 'second-private-key'}
        assert conn.execute('SELECT version_num FROM alembic_version').fetchone()[0] == 'public_demo_visitors'
        columns = {r[1] for r in conn.execute('PRAGMA table_info(settings)')}
        assert {'text_model_source', 'image_api_key', 'description_extra_fields'} <= columns
    with pytest.raises(ValueError, match='new file'):
        module.migrate(old, new)
    assert old.read_bytes() == before
