# 使用 Python 3.10 作为基础镜像（使用稳定版 Debian Bookworm）
FROM python:3.10-slim-bookworm

# 设置工作目录
WORKDIR /app

# 设置环境变量以避免 OpenBLAS 多线程问题
ENV OPENBLAS_NUM_THREADS=1
ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1

# 安装系统依赖（包括 ffmpeg）
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 安装 uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
RUN chmod +x /usr/local/bin/uv

# 复制项目配置文件
COPY pyproject.toml ./

# 安装 Python 依赖（不使用 lock 文件，每次重新解析）
RUN uv sync

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

