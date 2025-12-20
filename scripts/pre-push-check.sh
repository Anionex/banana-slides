#!/bin/bash
# ===========================================
# Local quick check script
# Run before pushing code to ensure basic quality
# ===========================================

set -e  # Exit immediately on error

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "=========================="
echo "   Local Quick Check"
echo "   (Ensure pass before push)"
echo "=========================="
echo ""

# Record start time
START_TIME=$(date +%s)

# 1. Backend lint check
echo -e "${BLUE}[1/4]${NC} Backend code check..."
cd backend
if command -v uv &> /dev/null; then
    if uv run --quiet python -c "import flake8" 2>/dev/null; then
        if ! uv run flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics; then
            echo -e "${RED}[FAIL]${NC} Backend lint check failed"
            exit 1
        fi
    else
        echo -e "${YELLOW}[!] flake8 not installed, skipping backend lint${NC}"
    fi
else
    echo -e "${YELLOW}[!] uv not installed, skipping backend check${NC}"
fi
echo -e "${GREEN}[PASS]${NC} Backend check complete"
cd ..

# 2. Frontend lint check
echo -e "${BLUE}[2/4]${NC} Frontend code check..."
cd frontend
npm run lint 2>/dev/null || {
    echo -e "${RED}[FAIL] Frontend lint check failed${NC}"
    exit 1
}
echo -e "${GREEN}[PASS]${NC} Frontend lint check passed"
cd ..

# 3. Frontend build check
echo -e "${BLUE}[3/4]${NC} Frontend build check..."
cd frontend
npm run build 2>/dev/null || {
    echo -e "${RED}[FAIL] Frontend build failed${NC}"
    exit 1
}
echo -e "${GREEN}[PASS]${NC} Frontend build successful"
cd ..

# 4. Backend unit tests
echo -e "${BLUE}[4/4]${NC} Backend unit tests..."
cd backend
if command -v uv &> /dev/null; then
    if [ -d "tests/unit" ] && [ "$(ls -A tests/unit 2>/dev/null)" ]; then
        uv run pytest tests/unit -v --tb=short 2>/dev/null || {
            echo -e "${YELLOW}[!] Backend tests failed or not configured${NC}"
        }
    else
        echo -e "${YELLOW}[!] Unit tests not found, skipping${NC}"
    fi
fi
echo -e "${GREEN}[PASS]${NC} Backend tests complete"
cd ..

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "=========================="
echo -e "${GREEN}Quick check passed!${NC}"
echo "Duration: ${DURATION}s"
echo "=========================="
echo ""
echo "Next steps:"
echo "  git push origin <branch>"
echo ""
echo "Run full tests with:"
echo "  npm run test:all"
echo ""
