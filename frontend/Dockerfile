# 镜像源配置参数（可通过 build args 覆盖）
ARG DOCKER_REGISTRY=
ARG NPM_REGISTRY=

# 构建阶段
# 如果指定了 DOCKER_REGISTRY，使用镜像源；否则使用官方源
FROM ${DOCKER_REGISTRY:-}node:18-alpine AS builder

# 重新声明ARG（FROM之后ARG作用域失效，需要重新声明）
ARG NPM_REGISTRY=

WORKDIR /app

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# 复制 package.json
COPY frontend/package.json ./

# 安装依赖（如果配置了 NPM_REGISTRY，先设置镜像源）
COPY frontend/package-lock.json* ./
RUN if [ -n "$NPM_REGISTRY" ]; then \
        npm config set registry "$NPM_REGISTRY"; \
    fi && \
    (npm install --frozen-lockfile || npm install)

# 复制前端源代码
COPY frontend/ ./

# 构建应用
RUN npm run build

# 生产阶段
# 如果指定了 DOCKER_REGISTRY，使用镜像源；否则使用官方源
FROM ${DOCKER_REGISTRY:-}nginx:alpine

# 复制构建产物到 nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 nginx 配置文件
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]

