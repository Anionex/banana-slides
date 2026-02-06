#!/bin/bash
# health-check.sh - Check health of staging or production environment
# Usage: ./scripts/health-check.sh [staging|production]
# Example: ./scripts/health-check.sh staging
#          ./scripts/health-check.sh production

set -e

ENV="${1:-production}"
FAILED=0

if [ "$ENV" = "staging" ]; then
    BACKEND_PORT=5002
    FRONTEND_PORT=3002
    COMPOSE_PROJECT="banana-staging"
    COMPOSE_FILE="docker-compose.staging.yml"
else
    BACKEND_PORT=5001
    FRONTEND_PORT=3001
    COMPOSE_PROJECT="banana-saas"
    COMPOSE_FILE="docker-compose.saas.yml"
fi

echo "=== Health Check: ${ENV} ==="
echo ""

# Check 1: Backend /health
echo -n "[backend] /health endpoint: "
HEALTH_CODE=$(curl -so /dev/null -w '%{http_code}' "http://localhost:${BACKEND_PORT}/health" 2>/dev/null || echo "000")
if [ "$HEALTH_CODE" = "200" ]; then
    echo "OK (HTTP ${HEALTH_CODE})"
else
    echo "FAIL (HTTP ${HEALTH_CODE})"
    FAILED=$((FAILED + 1))
fi

# Check 2: Frontend HTTP 200
echo -n "[frontend] HTTP response: "
FRONT_CODE=$(curl -so /dev/null -w '%{http_code}' "http://localhost:${FRONTEND_PORT}" 2>/dev/null || echo "000")
if [ "$FRONT_CODE" = "200" ]; then
    echo "OK (HTTP ${FRONT_CODE})"
else
    echo "FAIL (HTTP ${FRONT_CODE})"
    FAILED=$((FAILED + 1))
fi

# Check 3: Auth endpoint (not 5xx)
echo -n "[backend] /api/auth/login (non-5xx): "
AUTH_CODE=$(curl -so /dev/null -w '%{http_code}' -X POST "http://localhost:${BACKEND_PORT}/api/auth/login" \
    -H 'Content-Type: application/json' -d '{}' 2>/dev/null || echo "000")
if [ "$AUTH_CODE" -lt 500 ] 2>/dev/null; then
    echo "OK (HTTP ${AUTH_CODE})"
else
    echo "FAIL (HTTP ${AUTH_CODE})"
    FAILED=$((FAILED + 1))
fi

# Check 4: Docker container status
echo -n "[docker] Containers running: "
RUNNING=$(docker compose -p "${COMPOSE_PROJECT}" -f "${COMPOSE_FILE}" ps --status running -q 2>/dev/null | wc -l)
if [ "$RUNNING" -ge 2 ]; then
    echo "OK (${RUNNING} containers)"
else
    echo "FAIL (${RUNNING} containers running)"
    FAILED=$((FAILED + 1))
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
    echo "=== All checks passed ==="
    exit 0
else
    echo "=== ${FAILED} check(s) failed ==="
    exit 1
fi
