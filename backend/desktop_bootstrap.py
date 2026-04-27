"""Desktop-only startup compatibility helpers."""
import logging
from sqlalchemy import inspect as sqlalchemy_inspect, text


def repair_desktop_settings_schema(db):
    """Repair columns for desktop databases created by older builds."""
    inspector = sqlalchemy_inspect(db.engine)
    existing_tables = set(inspector.get_table_names())
    repair_specs = {
        'settings': {
            'ai_provider_format': 'VARCHAR(20)',
            'api_base_url': 'VARCHAR(500)',
            'api_key': 'VARCHAR(500)',
            'image_resolution': 'VARCHAR(20)',
            'image_aspect_ratio': 'VARCHAR(10)',
            'max_description_workers': 'INTEGER',
            'max_image_workers': 'INTEGER',
            'text_model': 'VARCHAR(100)',
            'image_model': 'VARCHAR(100)',
            'mineru_api_base': 'VARCHAR(255)',
            'mineru_token': 'VARCHAR(500)',
            'image_caption_model': 'VARCHAR(100)',
            'output_language': 'VARCHAR(10)',
            'enable_text_reasoning': 'BOOLEAN NOT NULL DEFAULT 0',
            'text_thinking_budget': 'INTEGER NOT NULL DEFAULT 1024',
            'enable_image_reasoning': 'BOOLEAN NOT NULL DEFAULT 0',
            'image_thinking_budget': 'INTEGER NOT NULL DEFAULT 1024',
            'description_generation_mode': 'VARCHAR(20)',
            'description_extra_fields': 'TEXT',
            'image_prompt_extra_fields': 'TEXT',
            'baidu_api_key': 'VARCHAR(500)',
            'text_model_source': 'VARCHAR(50)',
            'image_model_source': 'VARCHAR(50)',
            'image_caption_model_source': 'VARCHAR(50)',
            'lazyllm_api_keys': 'TEXT',
            'text_api_key': 'VARCHAR(500)',
            'text_api_base_url': 'VARCHAR(500)',
            'image_api_key': 'VARCHAR(500)',
            'image_api_base_url': 'VARCHAR(500)',
            'image_caption_api_key': 'VARCHAR(500)',
            'image_caption_api_base_url': 'VARCHAR(500)',
            'openai_oauth_access_token': 'TEXT',
            'openai_oauth_refresh_token': 'TEXT',
            'openai_oauth_expires_at': 'DATETIME',
            'openai_oauth_account_id': 'VARCHAR(100)',
            'created_at': 'DATETIME',
            'updated_at': 'DATETIME',
        },
        'projects': {
            'outline_requirements': 'TEXT',
            'description_requirements': 'TEXT',
            'template_style': 'TEXT',
            'export_extractor_method': "VARCHAR(50) DEFAULT 'hybrid'",
            'export_inpaint_method': "VARCHAR(50) DEFAULT 'hybrid'",
            'export_allow_partial': 'BOOLEAN DEFAULT 0',
            'image_aspect_ratio': "VARCHAR(10) DEFAULT '16:9'",
        },
        'pages': {
            'cached_image_path': 'VARCHAR(500)',
            'narration_text': 'TEXT',
        },
        'user_templates': {
            'thumb_path': 'VARCHAR(500)',
            'file_size': 'INTEGER',
        },
        'materials': {
            'caption': 'VARCHAR(500)',
            'original_filename': 'VARCHAR(500)',
        },
        'reference_files': {
            'mineru_batch_id': 'VARCHAR(100)',
        },
        'tasks': {
            'completed_at': 'DATETIME',
        },
        'user_style_templates': {
            'color': 'VARCHAR(20)',
        },
    }

    repaired = {}
    with db.engine.begin() as conn:
        for table_name, required_columns in repair_specs.items():
            if table_name not in existing_tables:
                continue
            existing_columns = {column['name'] for column in inspector.get_columns(table_name)}
            for column_name, column_type in required_columns.items():
                if column_name in existing_columns:
                    continue
                conn.execute(text(f'ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}'))
                repaired.setdefault(table_name, []).append(column_name)

        settings_columns = set()
        if 'settings' in existing_tables:
            settings_columns = {column['name'] for column in inspector.get_columns('settings')}
        if 'baidu_api_key' in repaired.get('settings', []) and 'baidu_ocr_api_key' in settings_columns:
            conn.execute(text(
                'UPDATE settings SET baidu_api_key = baidu_ocr_api_key '
                'WHERE baidu_api_key IS NULL AND baidu_ocr_api_key IS NOT NULL'
            ))

    if repaired:
        details = '; '.join(f"{table}: {', '.join(columns)}" for table, columns in repaired.items())
        logging.info(f"Repaired desktop database schema, added columns: {details}")
