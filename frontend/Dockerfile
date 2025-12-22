# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# 复制 package.json
COPY frontend/package.json ./

# 安装依赖（如果有 package-lock.json 会使用它，否则会生成新的）
COPY frontend/package-lock.json* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install

# 复制前端源代码
COPY frontend/ ./

# 构建应用
RUN npm run build

# 生产阶段
FROM nginx:alpine

# 复制构建产物到 nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 nginx 配置文件
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]

