# 镜像源配置参数（可通过 build args 覆盖）
ARG DOCKER_REGISTRY=
ARG GHCR_REGISTRY=ghcr.io/
ARG APT_MIRROR=
ARG PYPI_INDEX_URL=

# 安装 uv（使用中间阶段避免 COPY --from 的变量展开问题）
FROM ${GHCR_REGISTRY}astral-sh/uv:latest AS uv

# 使用 Python 3.10 作为基础镜像
# 如果指定了 DOCKER_REGISTRY，使用镜像源；否则使用官方源
FROM ${DOCKER_REGISTRY:-}python:3.10-slim

# 重新声明ARG（FROM之后ARG作用域失效，需要重新声明）
ARG APT_MIRROR=
ARG PYPI_INDEX_URL=

# 设置工作目录
WORKDIR /app

# 安装系统依赖（如果配置了 APT_MIRROR，先替换镜像源）
RUN if [ -n "$APT_MIRROR" ]; then \
        if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
            sed -i "s@deb.debian.org@$APT_MIRROR@g" /etc/apt/sources.list.d/debian.sources; \
        else \
            echo "Warning: /etc/apt/sources.list.d/debian.sources not found, skipping mirror setup." >&2; \
        fi; \
    fi && \
    apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 从 uv 阶段复制二进制文件
COPY --from=uv /uv /usr/local/bin/uv
RUN chmod +x /usr/local/bin/uv

# 复制项目配置文件
COPY pyproject.toml ./
COPY uv.lock* ./

# 配置 PyPI 镜像源（如果指定）
ENV UV_INDEX_URL=${PYPI_INDEX_URL}

# 配置 uv 网络超时
ENV UV_HTTP_TIMEOUT=300

# 安装 Python 依赖
# 如果有 uv.lock 文件则使用 --frozen，否则生成新的锁定文件
RUN if [ -f uv.lock ]; then \
        uv sync --frozen; \
    else \
        uv sync; \
    fi

# 复制后端代码
COPY backend/ ./backend/

# 复制测试资源
COPY assets/ ./assets/

# 创建必要的目录
RUN mkdir -p /app/backend/instance /app/uploads

ENV PYTHONPATH=/app
ENV FLASK_APP=backend/app.py
# 容器内固定监听 5000；宿主机端口由 docker-compose 的 BACKEND_PORT 控制
ENV IN_DOCKER=1

# 暴露端口
EXPOSE 5000

# 容器内部固定使用 5000 端口
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["sh", "-c", "curl -f http://localhost:5000/health || exit 1"]

# 启动应用
CMD ["sh", "-c", "uv run --directory backend alembic upgrade head && uv run --directory backend python app.py"]

