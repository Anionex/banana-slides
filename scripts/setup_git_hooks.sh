#!/bin/bash
# 设置Git Hooks

set -e

echo "================================="
echo "设置Git Hooks"
echo "================================="
echo ""
echo "ℹ️  注意: README 自动翻译已迁移到 GitHub Actions"
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

# 检查是否有启用的 hooks
if [ -f ".githooks/pre-commit.disabled" ]; then
    echo "发现已禁用的 pre-commit hook"
    echo ""
    echo "README 翻译现在由 GitHub Actions 自动处理："
    echo "  - 推送到主分支时自动翻译"
    echo "  - 不阻塞本地提交"
    echo "  - 节省 API 调用"
    echo ""
    read -p "是否要重新启用 pre-commit hook？(不推荐) [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        mv .githooks/pre-commit.disabled .githooks/pre-commit
        echo "✅ Pre-commit hook 已启用"
    else
        echo "✅ 保持 GitHub Actions 方案（推荐）"
        echo ""
        echo "手动翻译命令: uv run python scripts/translate_readme.py"
        exit 0
    fi
fi

# 配置Git使用自定义hooks目录
if [ -f ".githooks/pre-commit" ]; then
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
    echo "  - 每次提交可能需要等待 30-60 秒"
else
    echo ""
    echo "================================="
    echo "✅ 无需设置 Git Hooks"
    echo "================================="
    echo ""
    echo "README 翻译由 GitHub Actions 自动处理"
    echo "查看详情: .githooks/README.md"
fi

echo ""

