#!/usr/bin/env bash
# backup.sh — 备份 SQLite 数据库和上传文件，保留最近 7 天
# 加入 crontab 示例（每天凌晨 3 点执行）:
#   0 3 * * * /srv/banana-slides/deploy/scripts/backup.sh >> /data/backups/backup.log 2>&1
set -euo pipefail

BACKUP_ROOT="/data/backups/banana-slides"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEST="$BACKUP_ROOT/$TIMESTAMP"

mkdir -p "$DEST"

echo "[$TIMESTAMP] 开始备份..."

# 备份 SQLite — 使用 .backup 命令，对运行中的数据库安全（在线备份 API）
if [ -f /data/banana-slides/db/database.db ]; then
  sqlite3 /data/banana-slides/db/database.db ".backup '$DEST/database.db'"
  echo "  数据库已备份: $DEST/database.db"
else
  echo "  WARNING: database.db 不存在，跳过数据库备份"
fi

# 备份上传文件
if [ -d /data/banana-slides/uploads ] && [ "$(ls -A /data/banana-slides/uploads 2>/dev/null)" ]; then
  tar -czf "$DEST/uploads.tar.gz" -C /data/banana-slides uploads/
  echo "  上传文件已备份: $DEST/uploads.tar.gz"
else
  echo "  上传目录为空或不存在，跳过"
fi

# 清理 7 天前的备份
find "$BACKUP_ROOT" -maxdepth 1 -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true
echo "  已清理 7 天前的旧备份"

echo "[$TIMESTAMP] 备份完成: $DEST"
