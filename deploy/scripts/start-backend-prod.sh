#!/bin/sh
# deploy/scripts/start-backend-prod.sh
# 生产启动脚本：替换开发服务器，使用 gunicorn 多 worker
# 通过 docker-compose.tencent.yml 的 volumes 挂载覆盖容器内的启动脚本
set -e

cd /app

# 运行数据库迁移
uv run --directory backend alembic upgrade head

# 安装 gunicorn 到 venv（如果还没有）
uv pip install gunicorn --quiet 2>/dev/null || true

# 2核服务器：2 worker * 4 threads = 8 并发请求
# worker_class=gthread 支持多线程，适合 I/O 密集型（AI 调用）
exec /app/.venv/bin/gunicorn \
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
