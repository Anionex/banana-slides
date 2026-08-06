from pathlib import Path

from sqlalchemy import create_engine, text

from schema_compatibility import REQUIRED_COLUMNS, inspect_schema


MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / 'migrations'


def _schema_engine(include_required_columns=True, revision='022_structured_visual'):
    engine = create_engine('sqlite:///:memory:')
    project_columns = ['id TEXT PRIMARY KEY']
    page_columns = ['id TEXT PRIMARY KEY']
    if include_required_columns:
        project_columns.extend([
            "generation_mode VARCHAR(32) NOT NULL DEFAULT 'STANDARD_VISUAL'",
            'design_preferences_json TEXT',
            'design_spec_json TEXT',
            'design_spec_hash VARCHAR(64)',
            'design_spec_version INTEGER NOT NULL DEFAULT 0',
            'style_board_path VARCHAR(500)',
            'consistency_status VARCHAR(32)',
            'consistency_warnings_json TEXT',
        ])
        page_columns.append('page_plan_json TEXT')
    with engine.begin() as connection:
        connection.execute(text(f'CREATE TABLE projects ({", ".join(project_columns)})'))
        connection.execute(text(f'CREATE TABLE pages ({", ".join(page_columns)})'))
        connection.execute(text('CREATE TABLE alembic_version (version_num TEXT NOT NULL)'))
        connection.execute(
            text('INSERT INTO alembic_version (version_num) VALUES (:revision)'),
            {'revision': revision},
        )
    return engine


def test_schema_contract_accepts_current_head_and_required_columns():
    result = inspect_schema(_schema_engine(), MIGRATIONS_DIR)
    assert result.compatible
    assert result.missing_columns == ()
    assert result.invalid_columns == ()


def test_schema_contract_rejects_old_revision_even_when_columns_exist():
    result = inspect_schema(_schema_engine(revision='021_project_page_count'), MIGRATIONS_DIR)
    assert not result.compatible
    assert result.current_revisions == ('021_project_page_count',)


def test_schema_contract_rejects_missing_structured_visual_columns():
    result = inspect_schema(_schema_engine(include_required_columns=False), MIGRATIONS_DIR)
    assert not result.compatible
    assert 'projects.generation_mode' in result.missing_columns
    assert 'pages.page_plan_json' in result.missing_columns


def test_schema_contract_rejects_wrong_structured_visual_default():
    engine = _schema_engine()
    with engine.begin() as connection:
        connection.execute(text('ALTER TABLE projects RENAME TO old_projects'))
        connection.execute(text("""
            CREATE TABLE projects (
                id TEXT PRIMARY KEY,
                generation_mode VARCHAR(32) NOT NULL DEFAULT 'STRUCTURED_VISUAL',
                design_preferences_json TEXT, design_spec_json TEXT,
                design_spec_hash VARCHAR(64), design_spec_version INTEGER NOT NULL DEFAULT 0,
                style_board_path VARCHAR(500), consistency_status VARCHAR(32),
                consistency_warnings_json TEXT
            )
        """))
    result = inspect_schema(engine, MIGRATIONS_DIR)
    assert not result.compatible
    assert 'projects.generation_mode:default' in result.invalid_columns
