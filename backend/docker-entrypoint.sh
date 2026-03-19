#!/bin/bash
set -e

echo "=== Banana Slides Backend Entrypoint ==="

# --- Step 1: Backup SQLite DB (WAL-safe) ---
DB_PATH="/app/backend/instance/database.db"
BACKUP_DIR="/app/backend/instance/backups"

if [ -f "$DB_PATH" ]; then
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/database_${TIMESTAMP}.db"
    echo "[backup] Backing up database to $BACKUP_FILE ..."
    sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
    echo "[backup] Database backup completed."

    # Keep only last 5 backups
    ls -t "$BACKUP_DIR"/database_*.db 2>/dev/null | tail -n +6 | xargs -r rm --
    echo "[backup] Old backups cleaned (keeping last 5)."
else
    echo "[backup] No existing database found, skipping backup."
fi

# --- Step 2: Run Alembic migrations ---
echo "[migrate] Running database migrations ..."
cd /app/backend
if uv run alembic upgrade head; then
    echo "[migrate] Migrations completed successfully."
else
    echo "[migrate] ERROR: Migration failed! Aborting startup."
    exit 1
fi

# --- Step 3: Start the application ---
echo "[start] Starting Gunicorn application server ..."
cd /app
exec uv run --directory backend gunicorn \
    --workers "${GUNICORN_WORKERS:-2}" \
    --worker-class "${GUNICORN_WORKER_CLASS:-gthread}" \
    --threads "${GUNICORN_THREADS:-8}" \
    --bind "0.0.0.0:5000" \
    --timeout "${GUNICORN_TIMEOUT:-300}" \
    --graceful-timeout "${GUNICORN_GRACEFUL_TIMEOUT:-30}" \
    --keep-alive "${GUNICORN_KEEPALIVE:-5}" \
    --access-logfile - \
    --error-logfile - \
    app:app
