#!/bin/sh
set -e

cd /app
exec /app/.venv/bin/gunicorn \
    --chdir /app/backend \
    --workers "${BANANA_WEB_WORKERS:-1}" \
    --threads "${BANANA_WEB_THREADS:-8}" \
    --bind "0.0.0.0:${PORT:-5000}" \
    --timeout "${BANANA_HTTP_TIMEOUT_SECONDS:-300}" \
    --access-logfile - \
    --error-logfile - \
    'app:app'
