#!/bin/bash
# 设置Git Hooks

set -e

echo "================================="
echo "设置Git Hooks"
echo "================================="
echo ""

# 检查是否在项目根目录
if [ ! -d ".git" ]; then
    echo "错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 创建.githooks目录（如果不存在）
if [ ! -d ".githooks" ]; then
    echo "错误: .githooks目录不存在"
    exit 1
fi

# 配置Git使用自定义hooks目录
echo "配置Git使用.githooks目录..."
git config core.hooksPath .githooks

# 确保hooks有执行权限
echo "设置hooks执行权限..."
chmod +x .githooks/pre-commit

echo ""
echo "================================="
echo "✅ Git Hooks设置完成！"
echo "================================="
echo ""
echo "已启用的功能："
echo "  • pre-commit: 当README.md修改时自动翻译到README_EN.md"
echo ""
echo "提示："
echo "  - 修改README.md并提交时，会自动翻译README_EN.md"
echo "  - 需要在.env中配置GOOGLE_API_KEY"
echo "  - 如果翻译失败，不会阻止提交"
echo ""

