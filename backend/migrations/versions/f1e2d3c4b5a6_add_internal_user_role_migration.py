"""migrate legacy admin accounts into three-role model

Revision ID: f1e2d3c4b5a6
Revises: e6f7a8b9c0d1
Create Date: 2026-04-15 10:30:00.000000
"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa


revision = "f1e2d3c4b5a6"
down_revision = "e6f7a8b9c0d1"
branch_labels = None
depends_on = None


LEGACY_INTERNAL_USERNAMES = ("admin1", "admin3")
PRIMARY_ADMIN_USERNAME = "admin"


def _copy_settings_payload(row) -> dict:
    fields = (
        "ai_provider_format",
        "api_base_url",
        "api_key",
        "image_resolution",
        "image_aspect_ratio",
        "max_description_workers",
        "max_image_workers",
        "text_model",
        "image_model",
        "mineru_api_base",
        "mineru_token",
        "image_caption_model",
        "output_language",
        "enable_text_reasoning",
        "text_thinking_budget",
        "enable_image_reasoning",
        "image_thinking_budget",
        "description_generation_mode",
        "description_extra_fields",
        "image_prompt_extra_fields",
        "baidu_api_key",
        "text_model_source",
        "image_model_source",
        "image_caption_model_source",
        "lazyllm_api_keys",
        "text_api_key",
        "text_api_base_url",
        "image_api_key",
        "image_api_base_url",
        "image_caption_api_key",
        "image_caption_api_base_url",
    )
    return {field: row._mapping.get(field) for field in fields}


def upgrade():
    connection = op.get_bind()

    users = sa.table(
        "users",
        sa.column("id", sa.Integer()),
        sa.column("username", sa.String(50)),
        sa.column("role", sa.String(10)),
    )

    settings = sa.table(
        "settings",
        sa.column("id", sa.Integer()),
        sa.column("owner_user_id", sa.Integer()),
        sa.column("ai_provider_format", sa.String(20)),
        sa.column("api_base_url", sa.String(500)),
        sa.column("api_key", sa.String(500)),
        sa.column("image_resolution", sa.String(20)),
        sa.column("image_aspect_ratio", sa.String(10)),
        sa.column("max_description_workers", sa.Integer()),
        sa.column("max_image_workers", sa.Integer()),
        sa.column("text_model", sa.String(100)),
        sa.column("image_model", sa.String(100)),
        sa.column("mineru_api_base", sa.String(255)),
        sa.column("mineru_token", sa.String(500)),
        sa.column("image_caption_model", sa.String(100)),
        sa.column("output_language", sa.String(10)),
        sa.column("enable_text_reasoning", sa.Boolean()),
        sa.column("text_thinking_budget", sa.Integer()),
        sa.column("enable_image_reasoning", sa.Boolean()),
        sa.column("image_thinking_budget", sa.Integer()),
        sa.column("description_generation_mode", sa.String(20)),
        sa.column("description_extra_fields", sa.Text()),
        sa.column("image_prompt_extra_fields", sa.Text()),
        sa.column("baidu_api_key", sa.String(500)),
        sa.column("text_model_source", sa.String(50)),
        sa.column("image_model_source", sa.String(50)),
        sa.column("image_caption_model_source", sa.String(50)),
        sa.column("lazyllm_api_keys", sa.Text()),
        sa.column("text_api_key", sa.String(500)),
        sa.column("text_api_base_url", sa.String(500)),
        sa.column("image_api_key", sa.String(500)),
        sa.column("image_api_base_url", sa.String(500)),
        sa.column("image_caption_api_key", sa.String(500)),
        sa.column("image_caption_api_base_url", sa.String(500)),
    )

    user_rows = connection.execute(
        sa.select(users.c.id, users.c.username, users.c.role).where(users.c.username.isnot(None))
    ).fetchall()
    user_map = {row.username: row for row in user_rows}

    # 1. Keep the canonical admin account as admin.
    primary_admin = user_map.get(PRIMARY_ADMIN_USERNAME)
    if primary_admin is not None and primary_admin.role != "admin":
        connection.execute(
            users.update().where(users.c.id == primary_admin.id).values(role="admin")
        )

    # 2. Convert known legacy business/operator admins into internal users.
    for username in LEGACY_INTERNAL_USERNAMES:
        row = user_map.get(username)
        if row is None:
            continue
        if row.role != "internal":
            connection.execute(users.update().where(users.c.id == row.id).values(role="internal"))

    # 3. If the primary admin previously had a private settings row and the global row is empty,
    #    promote that config into the shared global settings row so regular users keep their platform config.
    global_settings = connection.execute(
        sa.select(settings).where(settings.c.owner_user_id.is_(None)).order_by(settings.c.id.asc())
    ).fetchone()
    admin_private_settings = None
    if primary_admin is not None:
        admin_private_settings = connection.execute(
            sa.select(settings)
            .where(settings.c.owner_user_id == primary_admin.id)
            .order_by(settings.c.id.asc())
        ).fetchone()

    if global_settings is None:
        connection.execute(settings.insert().values(owner_user_id=None))
        global_settings = connection.execute(
            sa.select(settings).where(settings.c.owner_user_id.is_(None)).order_by(settings.c.id.asc())
        ).fetchone()

    if global_settings is not None and admin_private_settings is not None:
        global_payload = _copy_settings_payload(global_settings)
        admin_payload = _copy_settings_payload(admin_private_settings)
        global_has_any_value = any(value not in (None, "", [], {}) for value in global_payload.values())
        admin_has_any_value = any(value not in (None, "", [], {}) for value in admin_payload.values())
        if not global_has_any_value and admin_has_any_value:
            connection.execute(
                settings.update()
                .where(settings.c.id == global_settings.id)
                .values(**admin_payload)
            )

    # 4. Ensure admin1/admin3 have a private settings row if they existed before.
    for username in LEGACY_INTERNAL_USERNAMES:
        row = user_map.get(username)
        if row is None:
            continue
        private_settings = connection.execute(
            sa.select(settings.c.id).where(settings.c.owner_user_id == row.id)
        ).fetchone()
        if private_settings is None:
            connection.execute(settings.insert().values(owner_user_id=row.id))


def downgrade():
    connection = op.get_bind()

    users = sa.table(
        "users",
        sa.column("id", sa.Integer()),
        sa.column("username", sa.String(50)),
        sa.column("role", sa.String(10)),
    )

    for username in LEGACY_INTERNAL_USERNAMES:
        connection.execute(
            users.update().where(users.c.username == username).values(role="admin")
        )
