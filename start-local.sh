#!/bin/bash
set -e

echo "========================================"
echo "  Banana Slides Local Start Script"
echo "========================================"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Find uv
if command -v uv &>/dev/null; then
    UV_CMD="uv"
elif [ -f "$HOME/.local/bin/uv" ]; then
    UV_CMD="$HOME/.local/bin/uv"
else
    echo "ERROR: uv not found. Please install uv first."
    exit 1
fi

echo ""
echo "[1/4] Syncing Python dependencies..."
cd "$PROJECT_DIR"
$UV_CMD sync

echo ""
echo "[2/4] Running database migration..."
cd "$BACKEND_DIR"
$UV_CMD run alembic -c alembic.ini upgrade head

echo ""
echo "[3/4] Starting backend..."
cd "$BACKEND_DIR"
$UV_CMD run python app.py &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

echo "Waiting for backend (3s)..."
sleep 3

echo ""
echo "[4/4] Starting frontend..."
cd "$FRONTEND_DIR"
npm install --prefer-offline &>/dev/null || true
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "========================================"
echo "  All services started!"
echo ""
echo "  Backend: http://localhost:5000"
echo "  Frontend: http://localhost:3000"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "========================================"

trap "echo ''; echo 'Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

wait
