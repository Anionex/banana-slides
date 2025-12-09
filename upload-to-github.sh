#!/bin/bash

# GitHub 上传脚本

echo "🚀 准备上传到 GitHub..."
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 检查 Git 是否已初始化
if [ ! -d ".git" ]; then
    echo "${YELLOW}初始化 Git 仓库...${NC}"
    git init
    echo "${GREEN}✓ Git 仓库已初始化${NC}"
else
    echo "${GREEN}✓ Git 仓库已存在${NC}"
fi

# 2. 检查敏感文件
echo ""
echo "${YELLOW}检查敏感文件...${NC}"

if [ -f "frontend/.env" ]; then
    if git check-ignore frontend/.env > /dev/null 2>&1; then
        echo "${GREEN}✓ frontend/.env 已被 .gitignore 忽略${NC}"
    else
        echo "${RED}✗ 警告：frontend/.env 没有被忽略！${NC}"
        echo "${RED}  请检查 .gitignore 文件${NC}"
        exit 1
    fi
else
    echo "${GREEN}✓ 没有 frontend/.env 文件${NC}"
fi

if [ -f ".env" ]; then
    if git check-ignore .env > /dev/null 2>&1; then
        echo "${GREEN}✓ .env 已被 .gitignore 忽略${NC}"
    else
        echo "${RED}✗ 警告：.env 没有被忽略！${NC}"
        exit 1
    fi
fi

# 3. 检查 node_modules
if [ -d "node_modules" ]; then
    if git check-ignore node_modules > /dev/null 2>&1; then
        echo "${GREEN}✓ node_modules 已被忽略${NC}"
    else
        echo "${YELLOW}⚠ node_modules 没有被忽略，建议添加到 .gitignore${NC}"
    fi
fi

# 4. 显示将要提交的文件
echo ""
echo "${YELLOW}将要提交的文件：${NC}"
git status --short

# 5. 确认
echo ""
read -p "确认要继续吗？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "${RED}已取消${NC}"
    exit 1
fi

# 6. 添加文件
echo ""
echo "${YELLOW}添加文件到 Git...${NC}"
git add .
echo "${GREEN}✓ 文件已添加${NC}"

# 7. 提交
echo ""
read -p "输入提交信息（默认：Initial commit）: " commit_msg
commit_msg=${commit_msg:-"Initial commit: Banana Slides AI PPT Generator"}

git commit -m "$commit_msg"
echo "${GREEN}✓ 已提交${NC}"

# 8. 检查远程仓库
echo ""
if git remote | grep -q "origin"; then
    echo "${GREEN}✓ 远程仓库已配置${NC}"
    git remote -v
else
    echo "${YELLOW}配置远程仓库...${NC}"
    read -p "输入 GitHub 仓库 URL（例如：https://github.com/username/banana-slides.git）: " repo_url
    
    if [ -z "$repo_url" ]; then
        echo "${RED}✗ 仓库 URL 不能为空${NC}"
        exit 1
    fi
    
    git remote add origin "$repo_url"
    echo "${GREEN}✓ 远程仓库已配置${NC}"
fi

# 9. 推送到 GitHub
echo ""
echo "${YELLOW}推送到 GitHub...${NC}"
git branch -M main

if git push -u origin main; then
    echo ""
    echo "${GREEN}✓✓✓ 成功上传到 GitHub！✓✓✓${NC}"
    echo ""
    echo "📝 下一步："
    echo "1. 访问你的 GitHub 仓库"
    echo "2. 检查文件是否正确上传"
    echo "3. 更新 README.md 中的链接"
    echo "4. 部署到 Vercel（可选）"
    echo ""
    echo "🎉 完成！"
else
    echo ""
    echo "${RED}✗ 推送失败${NC}"
    echo ""
    echo "可能的原因："
    echo "1. 仓库 URL 不正确"
    echo "2. 没有权限（需要配置 SSH Key 或 Personal Access Token）"
    echo "3. 网络问题"
    echo ""
    echo "解决方案："
    echo "1. 检查仓库 URL：git remote -v"
    echo "2. 配置认证：参考 GITHUB_UPLOAD_GUIDE.md"
    echo "3. 手动推送：git push -u origin main"
fi
