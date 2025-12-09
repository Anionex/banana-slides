#!/bin/bash

# Vercel 部署脚本 - 解决 MinerU CORS 问题

echo "🚀 开始部署到 Vercel..."

# 检查是否安装了 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI 未安装"
    echo "请运行: npm install -g vercel"
    exit 1
fi

# 检查环境变量
if [ ! -f "frontend/.env" ]; then
    echo "❌ frontend/.env 文件不存在"
    echo "请先配置环境变量"
    exit 1
fi

echo "✅ 环境检查通过"

# 构建前端
echo "📦 构建前端..."
cd frontend
npm install
npm run build
cd ..

echo "✅ 前端构建完成"

# 部署到 Vercel
echo "🚀 部署到 Vercel..."
vercel --prod

echo "✅ 部署完成！"
echo ""
echo "📝 下一步："
echo "1. 访问 Vercel Dashboard: https://vercel.com/dashboard"
echo "2. 进入项目 Settings -> Environment Variables"
echo "3. 添加以下环境变量："
echo "   - VITE_GEMINI_API_KEY"
echo "   - VITE_MINERU_TOKEN"
echo "   - VITE_GEMINI_API_BASE"
echo "   - VITE_MINERU_API_BASE"
echo "4. 重新部署: vercel --prod"
echo ""
echo "🎉 完成后，你的应用将支持 MinerU 文件解析（无 CORS 问题）"
