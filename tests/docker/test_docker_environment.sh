#!/bin/bash
# Docker环境完整测试脚本
# 测试项目在Docker环境下的完整功能

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# 测试开始
echo ""
echo "================================="
echo "🐳 Docker环境完整测试"
echo "================================="
echo ""

# 检查前置条件
log_info "检查前置条件..."

if ! command -v docker &> /dev/null; then
    log_error "Docker未安装，请先安装Docker"
    exit 1
fi

if ! command -v docker compose &> /dev/null && ! docker compose version &> /dev/null; then
    log_error "Docker Compose未安装"
    exit 1
fi

if [ ! -f ".env" ]; then
    log_warning ".env文件不存在，从.env.example复制"
    cp .env.example .env
fi

log_success "前置条件检查通过"

# 1. 清理旧环境
log_info "步骤1/10: 清理旧环境..."
docker compose down -v 2>/dev/null || true
docker system prune -f >/dev/null 2>&1 || true
log_success "环境清理完成"

# 2. 构建镜像
log_info "步骤2/10: 构建Docker镜像..."
if docker compose build --no-cache; then
    log_success "镜像构建成功"
else
    log_error "镜像构建失败"
    exit 1
fi

# 3. 启动服务
log_info "步骤3/10: 启动Docker服务..."
if docker compose up -d; then
    log_success "服务启动成功"
else
    log_error "服务启动失败"
    docker compose logs
    exit 1
fi

# 4. 等待服务就绪
log_info "步骤4/10: 等待服务就绪（最多60秒）..."
max_wait=60
waited=0
backend_ready=false
frontend_ready=false

while [ $waited -lt $max_wait ]; do
    # 检查后端
    if curl -s http://localhost:5010/health >/dev/null 2>&1; then
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
    log_error "服务启动超时"
    log_info "查看容器状态："
    docker compose ps
    log_info "查看后端日志："
    docker compose logs backend
    log_info "查看前端日志："
    docker compose logs frontend
    exit 1
fi

log_success "服务就绪（耗时 ${waited}秒）"

# 5. 检查容器健康状态
log_info "步骤5/10: 检查容器健康状态..."
backend_status=$(docker compose ps backend | grep -c "Up" || echo "0")
frontend_status=$(docker compose ps frontend | grep -c "Up" || echo "0")

if [ "$backend_status" -eq "0" ] || [ "$frontend_status" -eq "0" ]; then
    log_error "容器状态异常"
    docker compose ps
    exit 1
fi
log_success "容器状态正常"

# 6. 后端健康检查
log_info "步骤6/10: 后端健康检查..."
backend_health=$(curl -s http://localhost:5010/health)
if echo "$backend_health" | grep -q '"status":"ok"'; then
    log_success "后端健康检查通过"
    echo "    响应: $backend_health"
else
    log_error "后端健康检查失败"
    echo "    响应: $backend_health"
    exit 1
fi

# 7. 前端访问测试
log_info "步骤7/10: 前端访问测试..."
frontend_status_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$frontend_status_code" = "200" ]; then
    log_success "前端访问正常 (HTTP $frontend_status_code)"
else
    log_error "前端访问失败 (HTTP $frontend_status_code)"
    exit 1
fi

# 8. API功能测试
log_info "步骤8/10: API功能测试..."

# 8.1 创建项目
log_info "  8.1 创建项目..."
create_response=$(curl -s -X POST http://localhost:5010/api/projects \
    -H "Content-Type: application/json" \
    -d '{"creation_type":"idea","idea_prompt":"Docker测试项目"}')

if echo "$create_response" | grep -q '"success":true'; then
    project_id=$(echo "$create_response" | grep -o '"project_id":"[^"]*"' | cut -d'"' -f4)
    log_success "  项目创建成功: $project_id"
else
    log_error "  项目创建失败"
    echo "    响应: $create_response"
    exit 1
fi

# 8.2 获取项目
log_info "  8.2 获取项目详情..."
get_response=$(curl -s http://localhost:5010/api/projects/$project_id)
if echo "$get_response" | grep -q '"success":true'; then
    log_success "  项目获取成功"
else
    log_error "  项目获取失败"
    exit 1
fi

# 8.3 上传模板（如果存在）
if [ -f "template_g.png" ]; then
    log_info "  8.3 上传模板文件..."
    upload_response=$(curl -s -X POST http://localhost:5010/api/projects/$project_id/template \
        -F "template_image=@template_g.png")
    
    if echo "$upload_response" | grep -q '"success":true'; then
        log_success "  模板上传成功"
    else
        log_warning "  模板上传失败（非关键）"
    fi
else
    log_warning "  8.3 跳过模板上传（文件不存在）"
fi

# 8.4 删除项目（清理）
log_info "  8.4 删除测试项目..."
delete_response=$(curl -s -X DELETE http://localhost:5010/api/projects/$project_id)
if echo "$delete_response" | grep -q '"success":true'; then
    log_success "  项目删除成功"
else
    log_warning "  项目删除失败（非关键）"
fi

log_success "API功能测试通过"

# 9. 数据持久化测试
log_info "步骤9/10: 数据持久化测试..."

# 创建一个项目
create_response=$(curl -s -X POST http://localhost:5010/api/projects \
    -H "Content-Type: application/json" \
    -d '{"creation_type":"idea","idea_prompt":"持久化测试"}')
persist_project_id=$(echo "$create_response" | grep -o '"project_id":"[^"]*"' | cut -d'"' -f4)

# 重启后端容器
log_info "  重启后端容器..."
docker compose restart backend
sleep 5

# 等待后端恢复
for i in {1..30}; do
    if curl -s http://localhost:5010/health >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

# 检查项目是否还存在
persist_check=$(curl -s http://localhost:5010/api/projects/$persist_project_id)
if echo "$persist_check" | grep -q '"success":true'; then
    log_success "数据持久化测试通过"
else
    log_error "数据持久化测试失败"
    exit 1
fi

# 清理测试数据
curl -s -X DELETE http://localhost:5010/api/projects/$persist_project_id >/dev/null

# 10. 日志检查
log_info "步骤10/10: 检查容器日志是否有错误..."
backend_errors=$(docker compose logs backend 2>&1 | grep -i "error\|exception\|traceback" | grep -v "DEBUG" | wc -l)
frontend_errors=$(docker compose logs frontend 2>&1 | grep -i "error" | grep -v "warn" | wc -l)

if [ "$backend_errors" -gt 5 ]; then
    log_warning "后端日志中发现 $backend_errors 个错误"
    docker compose logs backend | grep -i "error\|exception" | tail -10
else
    log_success "后端日志检查通过（$backend_errors 个错误）"
fi

if [ "$frontend_errors" -gt 5 ]; then
    log_warning "前端日志中发现 $frontend_errors 个错误"
else
    log_success "前端日志检查通过（$frontend_errors 个错误）"
fi

# 测试总结
echo ""
echo "================================="
echo "✅ Docker环境测试完成"
echo "================================="
echo ""
echo "📊 测试摘要："
echo "  ✓ 镜像构建"
echo "  ✓ 服务启动"
echo "  ✓ 健康检查"
echo "  ✓ API功能"
echo "  ✓ 数据持久化"
echo "  ✓ 日志检查"
echo ""
echo "🎯 下一步："
echo "  1. 运行完整API测试: cd backend && python ../tests/test_e2e.py"
echo "  2. 运行E2E测试: npx playwright test"
echo "  3. 停止环境: docker compose down"
echo ""

# 询问是否清理环境
if [ "${AUTO_CLEANUP}" != "false" ]; then
    read -p "是否停止Docker环境？(y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "停止Docker环境..."
        docker compose down
        log_success "环境已清理"
    else
        log_info "保持环境运行，可手动执行: docker compose down"
    fi
fi

exit 0

