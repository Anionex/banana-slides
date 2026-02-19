#!/usr/bin/env bash
# Create a demo project with real slide images (bypasses AI generation).
# Usage: ./scripts/seed-demo-project.sh [PAGE_COUNT]
#
# Requires: backend running, curl, sqlite3, jq
# Reads BACKEND_PORT from .env (fallback 5000). Run from project root.

set -euo pipefail

PAGE_COUNT="${1:-3}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURES="$PROJECT_ROOT/frontend/e2e/fixtures"
DB="$PROJECT_ROOT/backend/instance/database.db"
UPLOADS="$PROJECT_ROOT/uploads"

# Resolve backend port (mirrors _compute_worktree_port in app.py)
if [[ -f "$PROJECT_ROOT/.env" ]]; then
  PORT=$(grep -E '^BACKEND_PORT=' "$PROJECT_ROOT/.env" 2>/dev/null | cut -d= -f2 | tr -d ' "' || true)
fi
if [[ -z "${PORT:-}" ]]; then
  BASENAME="$(basename "$PROJECT_ROOT")"
  OFFSET=$(printf '%s' "$BASENAME" | md5sum | cut -c1-8)
  OFFSET=$((16#$OFFSET % 500))
  PORT=$((5000 + OFFSET))
fi
BASE="http://localhost:$PORT"

# Verify backend is reachable
if ! curl -sf "$BASE/api/settings" >/dev/null 2>&1; then
  echo "ERROR: Backend not reachable at $BASE" >&2; exit 1
fi

# Create project
PROJECT_ID=$(curl -sf -X POST "$BASE/api/projects" \
  -H 'Content-Type: application/json' \
  -d '{"creation_type":"idea","idea_prompt":"demo project with images","template_style":"default"}' \
  | jq -r '.data.project_id')

echo "Project: $PROJECT_ID"

# Add pages with images
for i in $(seq 0 $((PAGE_COUNT - 1))); do
  PAGE_ID=$(curl -sf -X POST "$BASE/api/projects/$PROJECT_ID/pages" \
    -H 'Content-Type: application/json' \
    -d "{\"order_index\":$i,\"outline_content\":{\"title\":\"Slide $((i+1))\"}}" \
    | jq -r '.data.page_id')

  # Cycle through fixture images (1-3)
  FIX_NUM=$(( (i % 3) + 1 ))
  REL="$PROJECT_ID/pages/${PAGE_ID}_v1.jpg"
  mkdir -p "$UPLOADS/$PROJECT_ID/pages"
  cp "$FIXTURES/slide_${FIX_NUM}.jpg" "$UPLOADS/$REL"

  sqlite3 -cmd ".timeout 5000" "$DB" \
    "UPDATE pages SET generated_image_path='$REL', status='COMPLETED' WHERE id='$PAGE_ID'"

  echo "  Page $((i+1)): $PAGE_ID (slide_${FIX_NUM}.jpg)"
done

# Update project status
sqlite3 -cmd ".timeout 5000" "$DB" \
  "UPDATE projects SET status='IMAGES_GENERATED' WHERE id='$PROJECT_ID'"

echo "Done. Project status: IMAGES_GENERATED"
FPORT=$((PORT - 2000))
echo "Preview: http://localhost:$FPORT/project/$PROJECT_ID/preview"
