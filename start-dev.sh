#!/bin/bash

# Banana Slides 开发启动脚本
# 后台启动前端，前台运行后端以查看日志

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
FRONTEND_LOG="$PROJECT_ROOT/frontend.log"

echo "🍌 Banana Slides 开发环境启动"
echo "================================"

# 检查是否有残留进程
cleanup_existing() {
    # 清理前端进程 (vite dev server)
    if lsof -i:5173 >/dev/null 2>&1; then
        echo "⚠️  端口 5173 被占用，清理中..."
        kill $(lsof -t -i:5173) 2>/dev/null
        sleep 1
    fi

    # 清理后端进程
    if lsof -i:5000 >/dev/null 2>&1; then
        echo "⚠️  端口 5000 被占用，清理中..."
        kill $(lsof -t -i:5000) 2>/dev/null
        sleep 1
    fi
}

# 启动前端（后台）
start_frontend() {
    echo "🚀 启动前端 (后台)..."
    cd "$FRONTEND_DIR"

    # 检查 node_modules
    if [ ! -d "node_modules" ]; then
        echo "📦 安装前端依赖..."
        npm install
    fi

    # 后台启动 vite，日志输出到文件
    nohup npm run dev > "$FRONTEND_LOG" 2>&1 &
    FRONTEND_PID=$!
    echo "✅ 前端已启动 (PID: $FRONTEND_PID)"
    echo "📄 前端日志: $FRONTEND_LOG"
    echo "🌐 前端地址: http://localhost:5173"
}

# 数据库迁移
migrate_database() {
    echo ""
    echo "🗄️  执行数据库迁移..."
    cd "$PROJECT_ROOT/backend"
    uv run alembic -c alembic.ini upgrade head
    if [ $? -eq 0 ]; then
        echo "✅ 数据库迁移完成"
    else
        echo "⚠️  数据库迁移失败，请检查"
    fi
    cd "$PROJECT_ROOT"
}

# 启动后端（前台，显示日志）
start_backend() {
    echo ""
    echo "🚀 启动后端 (前台)..."
    echo "📡 后端地址: http://localhost:5000"
    echo "================================"
    echo ""

    cd "$PROJECT_ROOT"

    # 使用 uv run 启动后端
    uv run python backend/app.py
}

# 清理函数（Ctrl+C 时调用）
cleanup() {
    echo ""
    echo "🛑 停止服务..."

    # 停止前端
    if [ -n "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi

    # 清理端口
    kill $(lsof -t -i:5173) 2>/dev/null
    kill $(lsof -t -i:5000) 2>/dev/null

    echo "👋 已停止所有服务"
    exit 0
}

# 注册清理函数
trap cleanup SIGINT SIGTERM

# 主流程
cleanup_existing
start_frontend
migrate_database
start_backend
