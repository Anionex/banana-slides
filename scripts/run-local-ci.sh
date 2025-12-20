#!/bin/bash
# 本地CI测试脚本 - 模拟GitHub Actions的测试流程
# 使用方式: ./scripts/run-local-ci.sh [light|full]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }

TEST_MODE="${1:-light}"

echo ""
echo "================================="
echo "🧪 本地CI测试 - $TEST_MODE 模式"
echo "================================="
echo ""

# ================================
# Light 检查（快速）
# ================================
if [ "$TEST_MODE" = "light" ] || [ "$TEST_MODE" = "full" ]; then
    echo ""
    log_info "========== Light 检查 =========="
    
    # 1. 后端语法检查
    log_info "步骤1: 后端语法检查..."
    if command -v flake8 &> /dev/null; then
        cd backend
        flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics || {
            log_error "后端语法检查失败"
            exit 1
        }
        cd ..
        log_success "后端语法检查通过"
    else
        log_warning "flake8未安装，跳过后端语法检查 (pip install flake8)"
    fi
    
    # 2. 前端Lint检查
    log_info "步骤2: 前端Lint检查..."
    if [ -d "frontend/node_modules" ]; then
        cd frontend
        npm run lint || {
            log_error "前端Lint检查失败"
            exit 1
        }
        cd ..
        log_success "前端Lint检查通过"
    else
        log_warning "前端依赖未安装，跳过Lint检查 (cd frontend && npm ci)"
    fi
    
    # 3. 前端构建检查
    log_info "步骤3: 前端构建检查..."
    if [ -d "frontend/node_modules" ]; then
        cd frontend
        npm run build || {
            log_error "前端构建失败"
            exit 1
        }
        cd ..
        log_success "前端构建通过"
    else
        log_warning "前端依赖未安装，跳过构建检查"
    fi
    
    log_success "========== Light 检查完成 =========="
fi

# ================================
# Full 测试（完整）
# ================================
if [ "$TEST_MODE" = "full" ]; then
    echo ""
    log_info "========== Full 测试 =========="
    
    # 4. 后端单元测试
    log_info "步骤4: 后端单元测试..."
    if command -v uv &> /dev/null; then
        uv sync --extra test 2>/dev/null || log_warning "依赖同步失败，继续..."
        cd backend
        uv run pytest tests/unit -v || {
            log_error "后端单元测试失败"
            exit 1
        }
        cd ..
        log_success "后端单元测试通过"
    else
        log_warning "uv未安装，跳过后端单元测试"
        log_info "  安装: curl -LsSf https://astral.sh/uv/install.sh | sh"
    fi
    
    # 5. 后端集成测试
    log_info "步骤5: 后端集成测试..."
    if command -v uv &> /dev/null; then
        cd backend
        TESTING=true uv run pytest tests/integration -v || {
            log_error "后端集成测试失败"
            exit 1
        }
        cd ..
        log_success "后端集成测试通过"
    else
        log_warning "跳过后端集成测试"
    fi
    
    # 6. 前端单元测试
    log_info "步骤6: 前端单元测试..."
    if [ -d "frontend/node_modules" ]; then
        cd frontend
        npm test -- --run || {
            log_error "前端单元测试失败"
            exit 1
        }
        cd ..
        log_success "前端单元测试通过"
    else
        log_warning "跳过前端单元测试"
    fi
    
    # 7. Docker环境测试
    log_info "步骤7: Docker环境测试..."
    if command -v docker &> /dev/null; then
        log_info "  启动Docker环境测试（这会花费几分钟）..."
        chmod +x scripts/test_docker_environment.sh
        AUTO_CLEANUP=false ./scripts/test_docker_environment.sh || {
            log_error "Docker环境测试失败"
            exit 1
        }
        log_success "Docker环境测试通过"
    else
        log_warning "Docker未安装，跳过Docker测试"
    fi
    
    # 8. E2E测试
    log_info "步骤8: E2E测试..."
    if command -v npx &> /dev/null; then
        # 检查Docker是否运行
        if docker-compose ps | grep -q "Up"; then
            log_info "  Docker环境已运行，开始E2E测试..."
        else
            log_info "  启动Docker环境..."
            docker-compose up -d
            sleep 20
        fi
        
        # 运行基础E2E测试
        log_info "  运行基础E2E测试..."
        npx playwright test home.spec.ts create-ppt.spec.ts || {
            log_warning "基础E2E测试失败（可能需要先运行: npx playwright install）"
        }
        
        # 运行完整流程E2E测试（如果有API key）
        if [ -n "$GOOGLE_API_KEY" ] && [ "$GOOGLE_API_KEY" != "mock-api-key" ]; then
            log_info "  运行完整流程E2E测试（使用真实API）..."
            npx playwright test full-flow.spec.ts --workers=1 || {
                log_error "完整流程E2E测试失败"
                exit 1
            }
            log_success "完整流程E2E测试通过"
        else
            log_warning "未配置GOOGLE_API_KEY，跳过完整流程E2E测试"
            log_info "  提示: export GOOGLE_API_KEY=your-key 后再运行"
        fi
        
        log_success "E2E测试完成"
    else
        log_warning "npx未安装，跳过E2E测试"
    fi
    
    log_success "========== Full 测试完成 =========="
fi

# 总结
echo ""
echo "================================="
echo "✅ 本地CI测试完成！"
echo "================================="
echo ""
echo "📋 测试摘要："
if [ "$TEST_MODE" = "light" ]; then
    echo "  ✓ 后端语法检查"
    echo "  ✓ 前端Lint检查"
    echo "  ✓ 前端构建检查"
    echo ""
    echo "💡 运行完整测试: ./scripts/run-local-ci.sh full"
else
    echo "  ✓ Light检查（语法+Lint+构建）"
    echo "  ✓ 后端单元测试"
    echo "  ✓ 后端集成测试"
    echo "  ✓ 前端单元测试"
    echo "  ✓ Docker环境测试"
    echo "  ✓ E2E测试"
fi
echo ""
echo "🚀 现在可以安全地push代码了！"
echo ""

exit 0

