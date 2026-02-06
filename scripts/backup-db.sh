#!/bin/bash
# backup-db.sh - SQLite WAL-safe backup for Banana Slides
# Usage: ./scripts/backup-db.sh [environment]
# Example: ./scripts/backup-db.sh production
#          ./scripts/backup-db.sh staging
# Can be added to cron: 0 2 * * * /opt/banana-slides/scripts/backup-db.sh production

set -e

ENV="${1:-production}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/banana-slides}"
BACKUP_DIR="${DEPLOY_PATH}/backups"
MAX_BACKUPS=30

if [ "$ENV" = "staging" ]; then
    DB_PATH="${DEPLOY_PATH}/data-staging/instance/database.db"
    PREFIX="staging"
else
    DB_PATH="${DEPLOY_PATH}/data/instance/database.db"
    PREFIX="production"
fi

if [ ! -f "$DB_PATH" ]; then
    echo "Database not found: ${DB_PATH}"
    exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${PREFIX}_${TIMESTAMP}.db"

echo "Backing up ${ENV} database..."
echo "  Source: ${DB_PATH}"
echo "  Target: ${BACKUP_FILE}"

# WAL-safe backup using SQLite .backup command
sqlite3 "$DB_PATH" ".backup '${BACKUP_FILE}'"

# Verify backup
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "Backup completed: ${BACKUP_FILE} (${SIZE})"
else
    echo "ERROR: Backup file is empty or missing!"
    exit 1
fi

# Rotate old backups (keep MAX_BACKUPS)
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}/${PREFIX}_"*.db 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    REMOVE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
    echo "Rotating backups: removing ${REMOVE_COUNT} oldest..."
    ls -t "${BACKUP_DIR}/${PREFIX}_"*.db | tail -n "$REMOVE_COUNT" | xargs rm --
fi

echo "Done. Total ${PREFIX} backups: $(ls -1 "${BACKUP_DIR}/${PREFIX}_"*.db 2>/dev/null | wc -l)"
