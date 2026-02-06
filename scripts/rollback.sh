#!/bin/bash
# rollback.sh - Roll back production to a specific image tag
# Usage: ./scripts/rollback.sh <image-tag>
# Example: ./scripts/rollback.sh sha-6416ed6

set -e

TAG="${1:?Usage: $0 <image-tag>}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/banana-slides}"
COMPOSE_FILE="docker-compose.saas.yml"
PROJECT_NAME="banana-saas"

BACKEND_IMAGE="ghcr.io/anionex/banana-slides-saas-backend"
FRONTEND_IMAGE="ghcr.io/anionex/banana-slides-saas-frontend"

echo "=== Production Rollback ==="
echo "Target tag: ${TAG}"
echo "Deploy path: ${DEPLOY_PATH}"
echo ""

cd "$DEPLOY_PATH"

# Verify images exist in registry
echo "[1/4] Pulling images with tag: ${TAG} ..."
docker pull "${BACKEND_IMAGE}:${TAG}"
docker pull "${FRONTEND_IMAGE}:${TAG}"

# Stop current containers
echo "[2/4] Stopping current containers ..."
DEPLOY_TAG="${TAG}" docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" down || true

# Start with rollback tag
echo "[3/4] Starting containers with tag: ${TAG} ..."
DEPLOY_TAG="${TAG}" docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" up -d

# Health check
echo "[4/4] Waiting for health check ..."
sleep 15
for i in $(seq 1 10); do
    if curl -sf http://localhost:5001/health > /dev/null 2>&1; then
        echo ""
        echo "=== Rollback Successful ==="
        echo "Production is now running tag: ${TAG}"
        # Record the tag
        echo "${TAG}" > "${DEPLOY_PATH}/.last-production-tag"
        exit 0
    fi
    echo "  Attempt ${i}/10 - waiting..."
    sleep 5
done

echo ""
echo "ERROR: Health check failed after rollback!"
echo "Check logs: docker compose -p ${PROJECT_NAME} -f ${COMPOSE_FILE} logs"
exit 1
