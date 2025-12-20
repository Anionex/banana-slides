#!/bin/bash

echo "===================================="
echo "🍌 Vibe提案 前端启动脚本"
echo "===================================="
echo ""

echo "[1/3] 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "未检测到依赖，正在安装..."
    npm install
    if [ $? -ne 0 ]; then
        echo "依赖安装失败，请手动运行: npm install"
        exit 1
    fi
else
    echo "依赖已存在"
fi

echo ""
echo "[2/3] 检查环境变量..."
echo ""
echo "[3/3] 启动开发服务器..."
echo "前端将运行在 http://localhost:3000"
echo "请确保后端服务已启动在 http://localhost:5000"
echo ""
echo "按 Ctrl+C 可以停止服务器"
echo ""

npm run dev
