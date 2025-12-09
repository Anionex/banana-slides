#!/bin/bash

# Banana Slides 纯前端部署脚本
# 用于快速设置和部署纯前端版本

set -e

echo "🍌 Banana Slides - 纯前端部署脚本"
echo "=================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装 Node.js"
    echo "请访问 https://nodejs.org 安装 Node.js"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"
echo "✅ npm 版本: $(npm --version)"
echo ""

# 进入前端目录
cd frontend

echo "📦 安装依赖..."
npm install

echo ""
echo "📦 安装额外依赖..."
npm install @google/generative-ai uuid
npm install --save-dev @types/uuid

echo ""
echo "🔧 配置环境..."

# 创建 .env.production 文件
cat > .env.production << EOF
# 纯前端模式配置
VITE_MODE=local
VITE_APP_NAME=Banana Slides
VITE_APP_VERSION=1.0.0
EOF

echo "✅ 环境配置完成"
echo ""

# 询问用户是否要构建
read -p "是否现在构建生产版本? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🏗️  构建生产版本..."
    npm run build
    
    echo ""
    echo "✅ 构建完成！"
    echo ""
    echo "📁 构建文件位置: frontend/dist"
    echo ""
    
    # 询问是否部署
    read -p "是否要部署到 Vercel? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if ! command -v vercel &> /dev/null; then
            echo "📦 安装 Vercel CLI..."
            npm install -g vercel
        fi
        
        echo "🚀 部署到 Vercel..."
        vercel --prod
    else
        echo ""
        echo "📝 手动部署说明:"
        echo ""
        echo "Vercel 部署:"
        echo "  1. 安装 Vercel CLI: npm install -g vercel"
        echo "  2. 运行: vercel --prod"
        echo ""
        echo "Netlify 部署:"
        echo "  1. 安装 Netlify CLI: npm install -g netlify-cli"
        echo "  2. 运行: netlify deploy --prod"
        echo ""
        echo "或者直接上传 dist 目录到任何静态托管服务"
    fi
else
    echo ""
    echo "📝 后续步骤:"
    echo ""
    echo "开发模式:"
    echo "  cd frontend && npm run dev"
    echo ""
    echo "构建生产版本:"
    echo "  cd frontend && npm run build"
    echo ""
    echo "部署到 Vercel:"
    echo "  npm install -g vercel"
    echo "  cd frontend && vercel --prod"
fi

echo ""
echo "🎉 设置完成！"
echo ""
echo "📚 更多信息:"
echo "  - 使用指南: frontend/README_LOCAL_MODE.md"
echo "  - 部署文档: docs/FRONTEND_ONLY_SETUP.md"
echo ""
echo "⚙️  用户配置:"
echo "  用户首次使用时需要在应用中配置 API Key"
echo "  1. 打开应用"
echo "  2. 点击右上角设置按钮"
echo "  3. 输入 Gemini API Key"
echo "  4. (可选) 输入 MinerU Token"
echo ""
echo "🔗 获取 API Key:"
echo "  - Gemini: https://aistudio.google.com/apikey"
echo "  - MinerU: https://mineru.net"
echo ""
