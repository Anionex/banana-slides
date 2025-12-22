#!/bin/bash
# ============================================================================
# Banana Slides 镜像源自动检测与配置脚本
# ============================================================================
#
# 功能：自动检测用户 IP 所在地区，选择最优镜像源配置
#
# 使用方法：
#   bash setup-mirrors.sh          # 自动检测地区
#   bash setup-mirrors.sh cn       # 强制使用中国源
#   bash setup-mirrors.sh global   # 强制使用国外源
#   bash setup-mirrors.sh --help   # 显示帮助信息
#
# ============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# 输出文件
DETECTED_FILE=".env.detected"

# ============================================================================
# 帮助信息
# ============================================================================
show_help() {
    echo ""
    echo "🍌 Banana Slides 镜像源配置脚本"
    echo ""
    echo "使用方法："
    echo "  bash setup-mirrors.sh [选项]"
    echo ""
    echo "选项："
    echo "  (无参数)    自动检测 IP 地区，选择对应镜像源"
    echo "  cn          强制使用中国国内镜像源"
    echo "  global      强制使用国外官方源"
    echo "  --help, -h  显示此帮助信息"
    echo ""
    echo "示例："
    echo "  bash setup-mirrors.sh           # 自动检测"
    echo "  bash setup-mirrors.sh cn        # 使用中国源"
    echo "  bash setup-mirrors.sh global    # 使用国外源"
    echo ""
    echo "配置完成后会自动启动 Docker 构建"
    echo ""
}

# ============================================================================
# IP 地区检测函数
# ============================================================================
# 返回值：CN 或 GLOBAL（通过 echo 输出）
# 注意：此函数只输出结果，不打印日志（避免污染返回值）
detect_region() {
    # 方法1：使用 ipinfo.io API（最可靠）
    if command -v curl &> /dev/null; then
        local response
        response=$(curl -s --max-time 5 "https://ipinfo.io/json" 2>/dev/null || echo "")

        if [ -n "$response" ]; then
            # 提取 country 字段（不依赖 jq）
            local country
            country=$(echo "$response" | grep -o '"country":"[^"]*' | cut -d'"' -f4)

            if [ "$country" = "CN" ]; then
                echo "CN"
                return 0
            elif [ -n "$country" ]; then
                echo "GLOBAL"
                return 0
            fi
        fi
    fi

    # 方法2：尝试访问中国镜像源测试连通性
    if command -v curl &> /dev/null; then
        if curl -s --max-time 3 "https://mirrors.aliyun.com" &>/dev/null; then
            echo "CN"
            return 0
        fi
    fi

    # 方法3：默认使用中国源（项目主要用户在中国）
    echo "CN"
}

# ============================================================================
# 中国镜像源配置
# ============================================================================
get_china_config() {
    cat << 'EOF'
# ============================================================================
# 自动生成的镜像源配置文件 - 中国国内源
# ============================================================================
# 生成脚本: setup-mirrors.sh
# 说明: 此文件由脚本自动生成，请勿手动编辑
#       如需修改镜像源，请重新运行 setup-mirrors.sh
# ============================================================================

# 检测到的地区
DETECTED_REGION=CN

# Debian apt 镜像源（阿里云）
APT_MIRROR=mirrors.aliyun.com

# GitHub Container Registry 镜像（南京大学）
UV_IMAGE=ghcr.nju.edu.cn/astral-sh/uv:latest

# Python PyPI 镜像源（腾讯云）
PYPI_MIRROR=https://mirrors.cloud.tencent.com/pypi/simple

# npm 镜像源（淘宝 npmmirror）
NPM_MIRROR=https://registry.npmmirror.com/
EOF
}

# ============================================================================
# 国外官方源配置
# ============================================================================
get_global_config() {
    cat << 'EOF'
# ============================================================================
# 自动生成的镜像源配置文件 - 国外官方源
# ============================================================================
# 生成脚本: setup-mirrors.sh
# 说明: 此文件由脚本自动生成，请勿手动编辑
#       如需修改镜像源，请重新运行 setup-mirrors.sh
# ============================================================================

# 检测到的地区
DETECTED_REGION=GLOBAL

# Debian apt 镜像源（官方）
APT_MIRROR=deb.debian.org

# GitHub Container Registry（官方）
UV_IMAGE=ghcr.io/astral-sh/uv:latest

# Python PyPI 镜像源（官方）
PYPI_MIRROR=https://pypi.org/simple/

# npm 镜像源（官方）
NPM_MIRROR=https://registry.npmjs.org/
EOF
}

# ============================================================================
# 生成配置文件
# ============================================================================
generate_config() {
    local region=$1
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    log_info "生成配置文件: $DETECTED_FILE"

    # 添加时间戳头部
    echo "# 生成时间: $timestamp" > "$DETECTED_FILE"
    echo "" >> "$DETECTED_FILE"

    # 根据地区写入配置
    if [ "$region" = "CN" ]; then
        get_china_config >> "$DETECTED_FILE"
    else
        get_global_config >> "$DETECTED_FILE"
    fi

    log_success "配置文件已生成: $DETECTED_FILE"
}

# ============================================================================
# 修改 Dockerfile 中的镜像地址
# ============================================================================
patch_dockerfiles() {
    local region=$1
    local docker_mirror="docker.1ms.run"      # 国内 Docker Hub 镜像
    local ghcr_mirror="ghcr.nju.edu.cn"       # 国内 ghcr.io 镜像（南京大学）

    if [ "$region" = "CN" ]; then
        log_info "配置镜像加速..."

        # 修改 backend/Dockerfile
        if [ -f "backend/Dockerfile" ]; then
            # ghcr.io → ghcr.nju.edu.cn
            sed -i.bak "s|ghcr\.io/|${ghcr_mirror}/|g" backend/Dockerfile
            # python:3.10-slim → docker.1ms.run/python:3.10-slim
            sed -i.bak "s|^FROM [^/]*/python:|FROM python:|g" backend/Dockerfile 2>/dev/null || true
            sed -i.bak "s|^FROM python:|FROM ${docker_mirror}/python:|g" backend/Dockerfile
            rm -f backend/Dockerfile.bak
        fi

        # 修改 frontend/Dockerfile
        if [ -f "frontend/Dockerfile" ]; then
            # 先恢复可能存在的旧镜像配置
            sed -i.bak "s|^FROM [^/]*/node:|FROM node:|g" frontend/Dockerfile 2>/dev/null || true
            sed -i.bak "s|^FROM [^/]*/nginx:|FROM nginx:|g" frontend/Dockerfile 2>/dev/null || true
            # 再应用新配置
            sed -i.bak "s|^FROM node:|FROM ${docker_mirror}/node:|g" frontend/Dockerfile
            sed -i.bak "s|^FROM nginx:|FROM ${docker_mirror}/nginx:|g" frontend/Dockerfile
            rm -f frontend/Dockerfile.bak
        fi

        log_success "Dockerfile 已配置镜像加速"
    else
        # 恢复为官方源
        if [ -f "backend/Dockerfile" ]; then
            sed -i.bak "s|${ghcr_mirror}/|ghcr.io/|g" backend/Dockerfile 2>/dev/null || true
            sed -i.bak "s|^FROM [^/]*/python:|FROM python:|g" backend/Dockerfile 2>/dev/null || true
            rm -f backend/Dockerfile.bak
        fi

        if [ -f "frontend/Dockerfile" ]; then
            sed -i.bak "s|^FROM [^/]*/node:|FROM node:|g" frontend/Dockerfile 2>/dev/null || true
            sed -i.bak "s|^FROM [^/]*/nginx:|FROM nginx:|g" frontend/Dockerfile 2>/dev/null || true
            rm -f frontend/Dockerfile.bak
        fi
    fi
}

# ============================================================================
# 显示配置摘要
# ============================================================================
show_summary() {
    local region=$1

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [ "$region" = "CN" ]; then
        echo -e "${CYAN}📍 当前配置: 中国国内镜像源${NC}"
        echo ""
        echo "  • apt 镜像源:    mirrors.aliyun.com (阿里云)"
        echo "  • ghcr.io 镜像:  ghcr.nju.edu.cn (南京大学)"
        echo "  • PyPI 镜像源:   mirrors.cloud.tencent.com (腾讯云)"
        echo "  • npm 镜像源:    registry.npmmirror.com (淘宝)"
        echo "  • Docker Hub:    docker.1ms.run"
    else
        echo -e "${CYAN}📍 当前配置: 国外官方源${NC}"
        echo ""
        echo "  • apt 镜像源:    deb.debian.org (官方)"
        echo "  • ghcr.io 镜像:  ghcr.io (官方)"
        echo "  • PyPI 镜像源:   pypi.org (官方)"
        echo "  • npm 镜像源:    registry.npmjs.org (官方)"
        echo "  • Docker Hub:    docker.io (官方)"
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    echo -e "${GREEN}访问地址：${NC}"
    echo ""
    echo "  • 前端: http://localhost:3000"
    echo "  • 后端: http://localhost:5000"
    echo ""
}

# ============================================================================
# 启动 Docker 构建
# ============================================================================
start_docker_build() {
    echo ""
    log_info "开始 Docker 构建..."
    echo ""

    # 使用 --env-file 传入环境变量进行构建
    if docker compose --env-file "$DETECTED_FILE" up -d --build; then
        echo ""
        log_success "Docker 构建完成！"
    else
        echo ""
        log_error "Docker 构建失败，请检查错误信息"
        exit 1
    fi
}

# ============================================================================
# 主函数
# ============================================================================
main() {
    echo ""
    echo "🍌 Banana Slides 镜像源配置"
    echo ""

    local region=""

    # 解析命令行参数
    case "${1:-}" in
        cn|CN|china|CHINA)
            log_info "使用强制参数: 中国源"
            region="CN"
            ;;
        global|GLOBAL|intl|INTL)
            log_info "使用强制参数: 国外源"
            region="GLOBAL"
            ;;
        --help|-h|help)
            show_help
            exit 0
            ;;
        "")
            # 自动检测
            log_info "检测当前 IP 所在地区..."
            region=$(detect_region)
            if [ "$region" = "CN" ]; then
                log_info "检测到 IP 地区: 中国 (CN)"
            else
                log_info "检测到 IP 地区: 国外"
            fi
            ;;
        *)
            log_error "未知参数: $1"
            echo ""
            echo "使用 'bash setup-mirrors.sh --help' 查看帮助"
            exit 1
            ;;
    esac

    # 生成配置文件
    generate_config "$region"

    # 修改 Dockerfile 中的 Docker Hub 镜像地址
    patch_dockerfiles "$region"

    # 显示摘要
    show_summary "$region"

    # 自动启动 Docker 构建
    start_docker_build
}

# 执行主函数
main "$@"
