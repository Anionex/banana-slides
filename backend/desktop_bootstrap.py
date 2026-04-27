"""Desktop-only startup compatibility helpers."""
import logging
from sqlalchemy import inspect as sqlalchemy_inspect, text


def repair_desktop_settings_schema(db):
    """Repair settings columns for desktop databases created by older builds."""
    inspector = sqlalchemy_inspect(db.engine)
    if 'settings' not in inspector.get_table_names():
        return

    existing_columns = {column['name'] for column in inspector.get_columns('settings')}
    required_columns = {
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
    }

    added_columns = []
    with db.engine.begin() as conn:
        for column_name, column_type in required_columns.items():
            if column_name in existing_columns:
                continue
            conn.execute(text(f'ALTER TABLE settings ADD COLUMN {column_name} {column_type}'))
            added_columns.append(column_name)

        if 'baidu_api_key' in added_columns and 'baidu_ocr_api_key' in existing_columns:
            conn.execute(text(
                'UPDATE settings SET baidu_api_key = baidu_ocr_api_key '
                'WHERE baidu_api_key IS NULL AND baidu_ocr_api_key IS NOT NULL'
            ))

    if added_columns:
        logging.info(f"Repaired desktop settings schema, added columns: {', '.join(added_columns)}")
