#!/bin/bash
# ============================================================================
# Banana Slides 镜像源配置脚本
# ============================================================================
# 使用方法：
#   bash setup-mirrors.sh          # 自动检测地区
#   bash setup-mirrors.sh cn       # 强制使用中国源
#   bash setup-mirrors.sh global   # 强制使用国外源
# ============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }

# 检测 IP 地区
detect_region() {
    if command -v curl &> /dev/null; then
        local country
        country=$(curl -s --max-time 5 "https://ipinfo.io/country" 2>/dev/null | tr -d '\n' || echo "")
        if [ "$country" = "CN" ]; then
            echo "CN"
            return 0
        elif [ -n "$country" ]; then
            echo "GLOBAL"
            return 0
        fi
    fi
    echo "CN"
}

# 配置中国镜像源
apply_china_mirrors() {
    log_info "配置中国镜像源..."

    # backend/Dockerfile
    if [ -f "backend/Dockerfile" ]; then
        # 1. Docker Hub 镜像
        sed -i.bak 's|FROM python:3.10-slim|FROM docker.1ms.run/python:3.10-slim|g' backend/Dockerfile

        # 2. ghcr.io 镜像
        sed -i.bak 's|ghcr.io/astral-sh/uv|ghcr.nju.edu.cn/astral-sh/uv|g' backend/Dockerfile

        # 3. apt 镜像源（在 apt-get update 前插入 sed 命令）
        if ! grep -q "mirrors.aliyun.com" backend/Dockerfile; then
            awk '/RUN apt-get update/{print "# 配置 apt 镜像源"; print "RUN sed -i \"s@deb.debian.org@mirrors.aliyun.com@g\" /etc/apt/sources.list.d/debian.sources 2>/dev/null || true"; print ""}1' backend/Dockerfile > backend/Dockerfile.tmp && mv backend/Dockerfile.tmp backend/Dockerfile
        fi

        # 4. PyPI 镜像源（在 uv sync 前插入 ENV）
        if ! grep -q "UV_INDEX_URL" backend/Dockerfile; then
            awk '/RUN if \[ -f uv.lock \]/{print "# 配置 PyPI 镜像源"; print "ENV UV_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple"; print ""}1' backend/Dockerfile > backend/Dockerfile.tmp && mv backend/Dockerfile.tmp backend/Dockerfile
        fi

        rm -f backend/Dockerfile.bak
    fi

    # frontend/Dockerfile
    if [ -f "frontend/Dockerfile" ]; then
        # 1. Docker Hub 镜像
        sed -i.bak 's|FROM node:18-alpine|FROM docker.1ms.run/node:18-alpine|g' frontend/Dockerfile
        sed -i.bak 's|FROM nginx:alpine|FROM docker.1ms.run/nginx:alpine|g' frontend/Dockerfile

        # 2. npm 镜像源（在 npm install 前插入配置）
        if ! grep -q "registry.npmmirror.com" frontend/Dockerfile; then
            awk '/RUN npm install/{print "# 配置 npm 镜像源"; print "RUN npm config set registry https://registry.npmmirror.com/"; print ""}1' frontend/Dockerfile > frontend/Dockerfile.tmp && mv frontend/Dockerfile.tmp frontend/Dockerfile
        fi

        rm -f frontend/Dockerfile.bak
    fi

    log_success "已配置中国镜像源"
}

# 恢复官方源
apply_global_mirrors() {
    log_info "恢复官方源..."

    if [ -f "backend/Dockerfile" ]; then
        # Docker Hub
        sed -i.bak 's|FROM docker.1ms.run/python:3.10-slim|FROM python:3.10-slim|g' backend/Dockerfile
        # ghcr.io
        sed -i.bak 's|ghcr.nju.edu.cn/astral-sh/uv|ghcr.io/astral-sh/uv|g' backend/Dockerfile
        # 删除 apt 镜像源配置
        sed -i.bak '/# 配置 apt 镜像源/d' backend/Dockerfile
        sed -i.bak '/mirrors.aliyun.com/d' backend/Dockerfile
        # 删除 PyPI 镜像源配置
        sed -i.bak '/# 配置 PyPI 镜像源/d' backend/Dockerfile
        sed -i.bak '/UV_INDEX_URL/d' backend/Dockerfile
        rm -f backend/Dockerfile.bak
    fi

    if [ -f "frontend/Dockerfile" ]; then
        # Docker Hub
        sed -i.bak 's|FROM docker.1ms.run/node:18-alpine|FROM node:18-alpine|g' frontend/Dockerfile
        sed -i.bak 's|FROM docker.1ms.run/nginx:alpine|FROM nginx:alpine|g' frontend/Dockerfile
        # 删除 npm 镜像源配置
        sed -i.bak '/# 配置 npm 镜像源/d' frontend/Dockerfile
        sed -i.bak '/registry.npmmirror.com/d' frontend/Dockerfile
        rm -f frontend/Dockerfile.bak
    fi

    log_success "已恢复官方源"
}

# 显示配置摘要
show_summary() {
    local region=$1
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [ "$region" = "CN" ]; then
        echo -e "${CYAN}📍 当前配置: 中国镜像源${NC}"
        echo "  • Docker Hub: docker.1ms.run (1ms)"
        echo "  • ghcr.io:    ghcr.nju.edu.cn (南京大学)"
        echo "  • apt:        mirrors.aliyun.com (阿里云)"
        echo "  • PyPI:       mirrors.cloud.tencent.com (腾讯云)"
        echo "  • npm:        registry.npmmirror.com (淘宝)"
    else
        echo -e "${CYAN}📍 当前配置: 官方源${NC}"
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${GREEN}下一步:${NC} docker compose up -d"
    echo ""
}

# 主函数
main() {
    echo ""
    echo "🍌 Banana Slides 镜像源配置"
    echo ""

    local region=""
    case "${1:-}" in
        cn|CN) region="CN" ;;
        global|GLOBAL) region="GLOBAL" ;;
        "")
            log_info "检测 IP 地区..."
            region=$(detect_region)
            ;;
        *)
            echo "用法: bash setup-mirrors.sh [cn|global]"
            exit 1
            ;;
    esac

    if [ "$region" = "CN" ]; then
        apply_china_mirrors
    else
        apply_global_mirrors
    fi

    show_summary "$region"
}

main "$@"
