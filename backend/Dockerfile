# 使用 Python 3.10 作为基础镜像（使用稳定版 Debian Bookworm）
FROM python:3.10-slim-bookworm

# 设置工作目录
WORKDIR /app

# 安装 uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
RUN chmod +x /usr/local/bin/uv

# 复制项目配置文件
COPY pyproject.toml uv.lock ./

# 安装 Python 依赖
RUN uv sync --frozen

# 复制后端代码
COPY backend/ ./backend/

# 创建必要的目录
RUN mkdir -p /app/backend/instance /app/uploads

ENV PYTHONPATH=/app
ENV FLASK_APP=backend/app.py

# 暴露端口
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:5000/health').read()"]

# 启动应用
CMD ["uv", "run", "--directory", "backend", "python", "app.py"]

