#!/bin/sh
set -eu

cd /app/backend
exec /app/.venv/bin/alembic upgrade head
