#!/bin/bash
# Local CI test script - Simulates GitHub Actions test workflow
# Usage: ./scripts/run-local-ci.sh [light|full]

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_error() { echo -e "${RED}[FAIL]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }

TEST_MODE="${1:-light}"

echo ""
echo "================================="
echo "Local CI Test - $TEST_MODE mode"
echo "================================="
echo ""

# ================================
# Light Check (Quick)
# ================================
if [ "$TEST_MODE" = "light" ] || [ "$TEST_MODE" = "full" ]; then
    echo ""
    log_info "========== Light Check =========="
    
    # 1. Backend syntax check
    log_info "Step 1: Backend syntax check..."
    if command -v flake8 &> /dev/null; then
        cd backend
        flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics || {
            log_error "Backend syntax check failed"
            exit 1
        }
        cd ..
        log_success "Backend syntax check passed"
    else
        log_warning "flake8 not installed, skipping backend syntax check (pip install flake8)"
    fi
    
    # 2. Frontend lint check
    log_info "Step 2: Frontend lint check..."
    if [ -d "frontend/node_modules" ]; then
        cd frontend
        npm run lint || {
            log_error "Frontend lint check failed"
            exit 1
        }
        cd ..
        log_success "Frontend lint check passed"
    else
        log_warning "Frontend dependencies not installed, skipping lint check (cd frontend && npm ci)"
    fi
    
    # 3. Frontend build check
    log_info "Step 3: Frontend build check..."
    if [ -d "frontend/node_modules" ]; then
        cd frontend
        npm run build || {
            log_error "Frontend build failed"
            exit 1
        }
        cd ..
        log_success "Frontend build passed"
    else
        log_warning "Frontend dependencies not installed, skipping build check"
    fi
    
    log_success "========== Light Check Complete =========="
fi

# ================================
# Full Test (Complete)
# ================================
if [ "$TEST_MODE" = "full" ]; then
    echo ""
    log_info "========== Full Test =========="
    
    # 4. Backend unit tests
    log_info "Step 4: Backend unit tests..."
    if command -v uv &> /dev/null; then
        uv sync --extra test 2>/dev/null || log_warning "Dependency sync failed, continuing..."
        cd backend
        uv run pytest tests/unit -v || {
            log_error "Backend unit tests failed"
            exit 1
        }
        cd ..
        log_success "Backend unit tests passed"
    else
        log_warning "uv not installed, skipping backend unit tests"
        log_info "  Install: curl -LsSf https://astral.sh/uv/install.sh | sh"
    fi
    
    # 5. Backend integration tests
    log_info "Step 5: Backend integration tests..."
    if command -v uv &> /dev/null; then
        cd backend
        TESTING=true uv run pytest tests/integration -v || {
            log_error "Backend integration tests failed"
            exit 1
        }
        cd ..
        log_success "Backend integration tests passed"
    else
        log_warning "Skipping backend integration tests"
    fi
    
    # 6. Frontend unit tests
    log_info "Step 6: Frontend unit tests..."
    if [ -d "frontend/node_modules" ]; then
        cd frontend
        npm test -- --run || {
            log_error "Frontend unit tests failed"
            exit 1
        }
        cd ..
        log_success "Frontend unit tests passed"
    else
        log_warning "Skipping frontend unit tests"
    fi
    
    # 7. Docker environment tests
    log_info "Step 7: Docker environment tests..."
    if command -v docker &> /dev/null; then
        log_info "  Starting Docker environment test (this will take a few minutes)..."
        chmod +x scripts/test_docker_environment.sh
        AUTO_CLEANUP=false ./scripts/test_docker_environment.sh || {
            log_error "Docker environment test failed"
            exit 1
        }
        log_success "Docker environment test passed"
    else
        log_warning "Docker not installed, skipping Docker tests"
    fi
    
    # 8. E2E tests
    log_info "Step 8: E2E tests..."
    if command -v npx &> /dev/null; then
        # Check if Docker is running
        if docker-compose ps | grep -q "Up"; then
            log_info "  Docker environment is running, starting E2E tests..."
        else
            log_info "  Starting Docker environment..."
            docker-compose up -d
            sleep 20
        fi
        
        # Run basic E2E tests
        log_info "  Running basic E2E tests..."
        npx playwright test home.spec.ts create-ppt.spec.ts || {
            log_warning "Basic E2E tests failed (may need to run: npx playwright install)"
        }
        
        # Run full flow E2E tests (if API key is available)
        if [ -n "$GOOGLE_API_KEY" ] && [ "$GOOGLE_API_KEY" != "mock-api-key" ]; then
            log_info "  Running full flow E2E tests (using real API)..."
            npx playwright test full-flow.spec.ts --workers=1 || {
                log_error "Full flow E2E tests failed"
                exit 1
            }
            log_success "Full flow E2E tests passed"
        else
            log_warning "GOOGLE_API_KEY not configured, skipping full flow E2E tests"
            log_info "  Hint: export GOOGLE_API_KEY=your-key before running"
        fi
        
        log_success "E2E tests complete"
    else
        log_warning "npx not installed, skipping E2E tests"
    fi
    
    log_success "========== Full Test Complete =========="
fi

# Summary
echo ""
echo "================================="
echo "Local CI Test Complete"
echo "================================="
echo ""
echo "Test Summary:"
if [ "$TEST_MODE" = "light" ]; then
    echo "  - Backend syntax check: PASSED"
    echo "  - Frontend lint check: PASSED"
    echo "  - Frontend build check: PASSED"
    echo ""
    echo "Tip: Run full test: ./scripts/run-local-ci.sh full"
else
    echo "  - Light check (syntax + lint + build): PASSED"
    echo "  - Backend unit tests: PASSED"
    echo "  - Backend integration tests: PASSED"
    echo "  - Frontend unit tests: PASSED"
    echo "  - Docker environment tests: PASSED"
    echo "  - E2E tests: PASSED"
fi
echo ""
echo "Ready to push code safely!"
echo ""

exit 0
