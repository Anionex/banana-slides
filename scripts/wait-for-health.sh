#!/bin/bash
# Wait for service health check script
# Usage: ./wait-for-health.sh <url> [timeout_seconds] [interval_seconds]

set -e

URL="${1:-http://localhost:5010/health}"
TIMEOUT="${2:-60}"
INTERVAL="${3:-2}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Waiting for ${URL} to be healthy...${NC}"
echo -e "${YELLOW}Timeout: ${TIMEOUT}s, Check interval: ${INTERVAL}s${NC}"

start_time=$(date +%s)
elapsed=0

while [ $elapsed -lt $TIMEOUT ]; do
  if curl -f -s "$URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Service is healthy! (took ${elapsed}s)${NC}"
    exit 0
  fi
  
  echo -n "."
  sleep $INTERVAL
  elapsed=$(($(date +%s) - start_time))
done

echo ""
echo -e "${RED}✗ Timeout: Service did not become healthy within ${TIMEOUT}s${NC}"
echo -e "${RED}  URL: ${URL}${NC}"
exit 1

