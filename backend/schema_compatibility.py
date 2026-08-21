"""Read-only database compatibility checks for the product runtime."""

from dataclasses import dataclass
from pathlib import Path

from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory
from sqlalchemy import Integer, String, Text, inspect, text
from sqlalchemy.engine import Engine


REQUIRED_COLUMNS = {
    'projects': {
        'generation_mode',
        'design_preferences_json',
        'design_spec_json',
        'design_spec_hash',
        'design_spec_version',
        'style_board_path',
        'consistency_status',
        'consistency_warnings_json',
    },
    'pages': {'page_plan_json'},
}

COLUMN_CONTRACTS = {
    'projects': {
        'generation_mode': (String, 32, False, 'STANDARD_VISUAL'),
        'design_preferences_json': (Text, None, True, None),
        'design_spec_json': (Text, None, True, None),
        'design_spec_hash': (String, 64, True, None),
        'design_spec_version': (Integer, None, False, '0'),
        'style_board_path': (String, 500, True, None),
        'consistency_status': (String, 32, True, None),
        'consistency_warnings_json': (Text, None, True, None),
    },
    'pages': {
        'page_plan_json': (Text, None, True, None),
    },
}


@dataclass(frozen=True)
class SchemaCompatibility:
    compatible: bool
    expected_revisions: tuple[str, ...]
    current_revisions: tuple[str, ...]
    missing_columns: tuple[str, ...]
    invalid_columns: tuple[str, ...]


def _normalized_default(value) -> str | None:
    if value is None:
        return None
    return str(value).strip().strip('()').strip().strip("'\"")


def _expected_heads(migrations_dir: Path) -> tuple[str, ...]:
    config = AlembicConfig()
    config.set_main_option('script_location', str(migrations_dir))
    return tuple(sorted(ScriptDirectory.from_config(config).get_heads()))


def inspect_schema(engine: Engine, migrations_dir: Path) -> SchemaCompatibility:
    """Compare the connected schema with the migration tree without mutating it."""
    expected = _expected_heads(migrations_dir)
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    current: tuple[str, ...] = ()
    if 'alembic_version' in tables:
        with engine.connect() as connection:
            current = tuple(sorted(
                row[0] for row in connection.execute(text('SELECT version_num FROM alembic_version'))
            ))

    missing = []
    invalid = []
    for table, required in REQUIRED_COLUMNS.items():
        columns = (
            {column['name']: column for column in inspector.get_columns(table)}
            if table in tables else set()
        )
        existing = set(columns)
        missing.extend(f'{table}.{column}' for column in sorted(required - existing))
        for name in sorted(required & existing):
            expected_type, expected_length, nullable, default = COLUMN_CONTRACTS[table][name]
            column = columns[name]
            actual_type = column['type']
            if not isinstance(actual_type, expected_type):
                invalid.append(f'{table}.{name}:type')
            elif expected_length is not None and getattr(actual_type, 'length', None) != expected_length:
                invalid.append(f'{table}.{name}:length')
            if bool(column.get('nullable')) != nullable:
                invalid.append(f'{table}.{name}:nullable')
            if _normalized_default(column.get('default')) != default:
                invalid.append(f'{table}.{name}:default')

    return SchemaCompatibility(
        compatible=current == expected and not missing and not invalid,
        expected_revisions=expected,
        current_revisions=current,
        missing_columns=tuple(missing),
        invalid_columns=tuple(invalid),
    )
