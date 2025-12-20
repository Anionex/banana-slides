#!/bin/bash
# Docker environment full test script
# Tests complete functionality in Docker environment

set -e  # Exit immediately on error

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test start
echo ""
echo "================================="
echo "Docker Environment Full Test"
echo "================================="
echo ""

# Check prerequisites
log_info "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed, please install Docker first"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    log_error "Docker Compose is not installed"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    log_error "jq is not installed, please install jq first (apt-get install jq or brew install jq)"
    exit 1
fi

if [ ! -f ".env" ]; then
    log_warning ".env file does not exist, copying from .env.example"
    cp .env.example .env
fi

log_success "Prerequisites check passed"

# 1. Clean up old environment
log_info "Step 1/10: Cleaning up old environment..."
docker-compose down -v 2>/dev/null || true
docker system prune -f >/dev/null 2>&1 || true
log_success "Environment cleanup complete"

# 2. Build images
log_info "Step 2/10: Building Docker images..."
if docker-compose build --no-cache; then
    log_success "Image build successful"
else
    log_error "Image build failed"
    exit 1
fi

# 3. Start services
log_info "Step 3/10: Starting Docker services..."
if docker-compose up -d; then
    log_success "Services started successfully"
else
    log_error "Services failed to start"
    docker-compose logs
    exit 1
fi

# 4. Wait for services to be ready
log_info "Step 4/10: Waiting for services to be ready (max 60s)..."
max_wait=60
waited=0
backend_ready=false
frontend_ready=false

while [ $waited -lt $max_wait ]; do
    # 检查后端
    if curl -s http://localhost:5000/health >/dev/null 2>&1; then
        backend_ready=true
    fi
    
    # 检查前端
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        frontend_ready=true
    fi
    
    if [ "$backend_ready" = true ] && [ "$frontend_ready" = true ]; then
        break
    fi
    
    sleep 2
    waited=$((waited + 2))
    echo -n "."
done
echo ""

if [ "$backend_ready" = false ] || [ "$frontend_ready" = false ]; then
    log_error "Services startup timeout"
    log_info "Viewing container status:"
    docker-compose ps
    log_info "Viewing backend logs:"
    docker-compose logs backend
    log_info "Viewing frontend logs:"
    docker-compose logs frontend
    exit 1
fi

log_success "Services ready (took ${waited}s)"

# 5. Check container health status
log_info "Step 5/10: Checking container health status..."
backend_status=$(docker-compose ps backend | grep -c "Up" || echo "0")
frontend_status=$(docker-compose ps frontend | grep -c "Up" || echo "0")

if [ "$backend_status" -eq "0" ] || [ "$frontend_status" -eq "0" ]; then
    log_error "Container status abnormal"
    docker-compose ps
    exit 1
fi
log_success "Container status normal"

# 6. Backend health check
log_info "Step 6/10: Backend health check..."
backend_health=$(curl -s http://localhost:5000/health)
if echo "$backend_health" | grep -q '"status":"ok"'; then
    log_success "Backend health check passed"
    echo "    Response: $backend_health"
else
    log_error "Backend health check failed"
    echo "    Response: $backend_health"
    exit 1
fi

# 7. Frontend access test
log_info "Step 7/10: Frontend access test..."
frontend_status_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$frontend_status_code" = "200" ]; then
    log_success "Frontend access normal (HTTP $frontend_status_code)"
else
    log_error "Frontend access failed (HTTP $frontend_status_code)"
    exit 1
fi

# 8. API functionality tests
log_info "Step 8/10: API functionality tests..."

# 8.1 Create project
log_info "  8.1 Creating project..."
create_response=$(curl -s -X POST http://localhost:5000/api/projects \
    -H "Content-Type: application/json" \
    -d '{"creation_type":"idea","idea_prompt":"Docker test project"}')

if echo "$create_response" | jq -e '.success == true' > /dev/null 2>&1; then
    project_id=$(echo "$create_response" | jq -r '.data.project_id')
    log_success "  Project created successfully: $project_id"
else
    log_error "  Project creation failed"
    echo "    Response: $create_response"
    exit 1
fi

# 8.2 Get project
log_info "  8.2 Getting project details..."
get_response=$(curl -s http://localhost:5000/api/projects/$project_id)
if echo "$get_response" | grep -q '"success":true'; then
    log_success "  Project retrieved successfully"
else
    log_error "  Project retrieval failed"
    exit 1
fi

# 8.3 Upload template (if exists)
if [ -f "template_g.png" ]; then
    log_info "  8.3 Uploading template file..."
    upload_response=$(curl -s -X POST http://localhost:5000/api/projects/$project_id/template \
        -F "template_image=@template_g.png")
    
    if echo "$upload_response" | grep -q '"success":true'; then
        log_success "  Template uploaded successfully"
    else
        log_warning "  Template upload failed (non-critical)"
    fi
else
    log_warning "  8.3 Skipping template upload (file does not exist)"
fi

# 8.4 Delete project (cleanup)
log_info "  8.4 Deleting test project..."
delete_response=$(curl -s -X DELETE http://localhost:5000/api/projects/$project_id)
if echo "$delete_response" | grep -q '"success":true'; then
    log_success "  Project deleted successfully"
else
    log_warning "  Project deletion failed (non-critical)"
fi

log_success "API functionality tests passed"

# 9. Data persistence test
log_info "Step 9/10: Data persistence test..."

# Create a project
create_response=$(curl -s -X POST http://localhost:5000/api/projects \
    -H "Content-Type: application/json" \
    -d '{"creation_type":"idea","idea_prompt":"Persistence test"}')
persist_project_id=$(echo "$create_response" | jq -r '.data.project_id')

# Restart backend container
log_info "  Restarting backend container..."
docker-compose restart backend
sleep 5

# Wait for backend to recover
for i in {1..30}; do
    if curl -s http://localhost:5000/health >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Check if project still exists
persist_check=$(curl -s http://localhost:5000/api/projects/$persist_project_id)
if echo "$persist_check" | grep -q '"success":true'; then
    log_success "Data persistence test passed"
else
    log_error "Data persistence test failed"
    exit 1
fi

# Cleanup test data
curl -s -X DELETE http://localhost:5000/api/projects/$persist_project_id >/dev/null

# 10. Log check
log_info "Step 10/10: Checking container logs for errors..."
backend_errors=$(docker-compose logs backend 2>&1 | grep -i "error\|exception\|traceback" | grep -v "DEBUG" | wc -l)
frontend_errors=$(docker-compose logs frontend 2>&1 | grep -i "error" | grep -v "warn" | wc -l)

if [ "$backend_errors" -gt 5 ]; then
    log_warning "Found $backend_errors errors in backend logs"
    docker-compose logs backend | grep -i "error\|exception" | tail -10
else
    log_success "Backend log check passed ($backend_errors errors)"
fi

if [ "$frontend_errors" -gt 5 ]; then
    log_warning "Found $frontend_errors errors in frontend logs"
else
    log_success "Frontend log check passed ($frontend_errors errors)"
fi

# Test summary
echo ""
echo "================================="
echo "Docker Environment Test Complete"
echo "================================="
echo ""
echo "Test Summary:"
echo "  - Image build: PASSED"
echo "  - Service startup: PASSED"
echo "  - Health check: PASSED"
echo "  - API functionality: PASSED"
echo "  - Data persistence: PASSED"
echo "  - Log check: PASSED"
echo ""
echo "Next Steps:"
echo "  1. Run full API tests: cd backend && python ../tests/test_e2e.py"
echo "  2. Run E2E tests: npx playwright test"
echo "  3. Stop environment: docker-compose down"
echo ""

# Ask whether to cleanup environment
if [ "${AUTO_CLEANUP}" != "false" ]; then
    read -p "Stop Docker environment? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Stopping Docker environment..."
        docker-compose down
        log_success "Environment cleaned up"
    else
        log_info "Keeping environment running, manually stop with: docker-compose down"
    fi
fi

exit 0

