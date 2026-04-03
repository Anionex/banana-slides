#!/usr/bin/env bash
# deploy.sh — 拉取最新代码，重新构建镜像，重启容器，验证健康状态
# 在服务器上从仓库根目录执行: bash deploy/scripts/deploy.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$REPO_DIR/deploy/docker-compose.tencent.yml"
ENV_FILE="$REPO_DIR/deploy/.env"

# ── 前置检查 ───────────────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE 不存在"
  echo "请执行: cp deploy/.env.tencent deploy/.env 并填写必要配置"
  exit 1
fi

# 确保数据目录存在
sudo mkdir -p /data/banana-slides/db /data/banana-slides/uploads
sudo chown -R "$USER:$USER" /data/banana-slides

echo "==> [1/4] 拉取最新代码..."
cd "$REPO_DIR"
git fetch origin
git merge --ff-only origin/deploy/tencent

echo "==> [2/4] 构建镜像（首次构建约需 5-10 分钟）..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --pull

echo "==> [3/4] 重启容器..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans

echo "==> [4/4] 等待健康检查..."
RETRIES=12
INTERVAL=5
for i in $(seq 1 $RETRIES); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' banana-slides 2>/dev/null || echo "starting")
  if [ "$STATUS" = "healthy" ]; then
    echo "容器状态正常 (healthy)"
    break
  fi
  if [ "$i" -eq "$RETRIES" ]; then
    echo "WARNING: 容器在 $((RETRIES * INTERVAL))s 内未变为 healthy 状态"
    echo "查看日志: docker logs banana-slides --tail 50"
    exit 1
  fi
  echo "  当前状态: $STATUS — 等待 ${INTERVAL}s... ($i/$RETRIES)"
  sleep $INTERVAL
done

echo ""
echo "部署完成，最近 20 行日志："
docker logs banana-slides --tail 20
