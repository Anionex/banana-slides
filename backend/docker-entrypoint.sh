#!/bin/bash
set -e

echo "=== Banana Slides Backend Entrypoint ==="

# --- Step 1: Backup SQLite DB (WAL-safe) ---
DB_PATH="/app/backend/instance/banana_slides.db"
BACKUP_DIR="/app/backend/instance/backups"

if [ -f "$DB_PATH" ]; then
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/banana_slides_${TIMESTAMP}.db"
    echo "[backup] Backing up database to $BACKUP_FILE ..."
    sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
    echo "[backup] Database backup completed."

    # Keep only last 5 backups
    ls -t "$BACKUP_DIR"/banana_slides_*.db 2>/dev/null | tail -n +6 | xargs -r rm --
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
echo "[start] Starting Flask application ..."
cd /app
exec uv run --directory backend python app.py
