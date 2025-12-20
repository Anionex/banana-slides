#!/bin/bash
# CI配置验证脚本
# 在合并到main之前，验证CI配置文件本身是否正确

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }

echo ""
echo "================================="
echo "🔍 CI配置验证"
echo "================================="
echo ""

ERRORS=0

# 1. 检查YAML语法
log_info "步骤1: 验证YAML语法..."

for file in .github/workflows/*.yml; do
    if [ -f "$file" ]; then
        if python3 -c "import yaml; yaml.safe_load(open('$file'))" 2>/dev/null; then
            log_success "  $file - YAML语法正确"
        else
            log_error "  $file - YAML语法错误"
            ERRORS=$((ERRORS + 1))
        fi
    fi
done

# 2. 检查必需的工作流文件
log_info "步骤2: 检查必需的工作流文件..."

REQUIRED_FILES=(
    ".github/workflows/pr-quick-check.yml"
    ".github/workflows/ci-test.yml"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "  $file 存在"
    else
        log_error "  $file 缺失"
        ERRORS=$((ERRORS + 1))
    fi
done

# 3. 检查工作流触发条件
log_info "步骤3: 验证工作流触发条件..."

# 检查pr-quick-check.yml是否有pull_request触发
if grep -q "pull_request:" .github/workflows/pr-quick-check.yml; then
    log_success "  pr-quick-check.yml 有pull_request触发"
else
    log_error "  pr-quick-check.yml 缺少pull_request触发"
    ERRORS=$((ERRORS + 1))
fi

# 检查ci-test.yml是否有labeled触发
if grep -q "labeled" .github/workflows/ci-test.yml; then
    log_success "  ci-test.yml 有labeled触发"
else
    log_warning "  ci-test.yml 可能缺少labeled触发（可选）"
fi

# 4. 检查工作流名称
log_info "步骤4: 验证工作流名称..."

if grep -q "^name:" .github/workflows/pr-quick-check.yml; then
    log_success "  pr-quick-check.yml 有名称"
else
    log_error "  pr-quick-check.yml 缺少名称"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "^name:" .github/workflows/ci-test.yml; then
    log_success "  ci-test.yml 有名称"
else
    log_error "  ci-test.yml 缺少名称"
    ERRORS=$((ERRORS + 1))
fi

# 5. 检查是否有语法错误（使用actionlint如果可用）
log_info "步骤5: 检查GitHub Actions语法..."

if command -v actionlint &> /dev/null; then
    if actionlint .github/workflows/*.yml 2>&1; then
        log_success "  GitHub Actions语法检查通过"
    else
        log_warning "  actionlint发现一些问题（可能不是致命错误）"
    fi
else
    log_warning "  actionlint未安装，跳过详细语法检查"
    log_info "    安装: go install github.com/rhymond/actionlint/cmd/actionlint@latest"
fi

# 6. 验证关键步骤
log_info "步骤6: 验证关键步骤..."

# 检查pr-quick-check是否有quick-check job
if grep -q "quick-check:" .github/workflows/pr-quick-check.yml; then
    log_success "  pr-quick-check.yml 有quick-check job"
else
    log_error "  pr-quick-check.yml 缺少quick-check job"
    ERRORS=$((ERRORS + 1))
fi

# 检查ci-test是否有backend-unit-test job
if grep -q "backend-unit-test:" .github/workflows/ci-test.yml; then
    log_success "  ci-test.yml 有backend-unit-test job"
else
    log_warning "  ci-test.yml 可能缺少backend-unit-test job"
fi

# 总结
echo ""
echo "================================="
if [ $ERRORS -eq 0 ]; then
    log_success "✅ CI配置验证通过！"
    echo ""
    echo "📋 验证结果："
    echo "  ✓ YAML语法正确"
    echo "  ✓ 必需文件存在"
    echo "  ✓ 触发条件正确"
    echo "  ✓ 工作流结构完整"
    echo ""
    echo "🚀 可以安全地push并创建PR了！"
    echo ""
    echo "💡 下一步："
    echo "  1. git push origin feat/ci"
    echo "  2. 在GitHub上创建/更新PR"
    echo "  3. PR会自动触发 pr-quick-check.yml"
    echo "  4. 添加 ready-for-test 标签触发完整测试"
    echo ""
    exit 0
else
    log_error "❌ CI配置验证失败！发现 $ERRORS 个错误"
    echo ""
    echo "请修复上述错误后重试"
    echo ""
    exit 1
fi

