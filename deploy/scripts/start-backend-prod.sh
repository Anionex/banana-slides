#!/bin/sh
# Production backend entrypoint for Tencent deployment.
set -e

cd /app

# Apply database migrations before serving traffic.
uv run --directory backend alembic upgrade head

# 2 vCPU server: 2 workers * 4 threads = 8 concurrent requests.
exec uv run --directory backend gunicorn \
  --chdir /app/backend \
  --bind 0.0.0.0:5000 \
  --workers 2 \
  --worker-class gthread \
  --threads 4 \
  --timeout 300 \
  --keep-alive 5 \
  --access-logfile - \
  --error-logfile - \
  "app:create_app()"
