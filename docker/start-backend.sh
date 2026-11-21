#!/bin/sh
set -e

cd /app
uv run --directory backend alembic upgrade head
exec uv run --directory backend python app.py
