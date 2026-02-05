# SaaS 自动部署指南

## 架构

```
GitHub (feat/saas) --push--> GitHub Actions --build--> Docker Hub --pull--> 服务器
                                    |
                                    +--SSH--> 服务器执行部署
```

## 一、GitHub Secrets 配置

在 GitHub 仓库 Settings > Secrets and variables > Actions 中添加：

| Secret 名称 | 说明 | 示例 |
|------------|------|------|
| `DOCKERHUB_USERNAME` | Docker Hub 用户名 | `anoinex` |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token | `dckr_pat_xxx` |
| `SERVER_HOST` | 服务器 IP 或域名 | `123.45.67.89` |
| `SERVER_USER` | SSH 用户名 | `root` 或 `ubuntu` |
| `SERVER_SSH_KEY` | SSH 私钥 (整个内容) | `-----BEGIN OPENSSH...` |
| `SERVER_PORT` | SSH 端口 (可选) | `22` |
| `DEPLOY_PATH` | 部署目录 (可选) | `/opt/banana-slides` |

### 生成 SSH 密钥

```bash
# 本地生成密钥对
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy

# 将公钥添加到服务器
ssh-copy-id -i ~/.ssh/github_deploy.pub user@your-server

# 将私钥内容复制到 GitHub Secrets (SERVER_SSH_KEY)
cat ~/.ssh/github_deploy
```

## 二、服务器初始化

```bash
# 1. 安装 Docker (如果没有)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2. 运行初始化脚本
curl -fsSL https://raw.githubusercontent.com/Anionex/banana-slides-saas/feat/saas/deploy/server-setup.sh | bash

# 3. 配置环境变量
cd /opt/banana-slides
nano .env  # 填入你的 API keys

# 4. 首次手动启动 (之后会自动)
docker compose -f docker-compose.saas.yml up -d
```

## 三、使用方式

### 自动部署
推送到 `feat/saas` 分支会自动触发部署：

```bash
git checkout feat/saas
git add .
git commit -m "your changes"
git push origin feat/saas
```

### 手动触发部署
在 GitHub Actions 页面点击 "Run workflow"

### 跳过构建直接部署
手动触发时勾选 "跳过构建，直接使用最新镜像"

## 四、服务端口

| 服务 | 端口 |
|------|------|
| 前端 | 3001 |
| 后端 | 5001 |

## 五、常用命令

```bash
cd /opt/banana-slides

# 查看状态
docker compose -f docker-compose.saas.yml ps

# 查看日志
docker compose -f docker-compose.saas.yml logs -f

# 只看后端日志
docker compose -f docker-compose.saas.yml logs -f backend

# 重启服务
docker compose -f docker-compose.saas.yml restart

# 停止服务
docker compose -f docker-compose.saas.yml down

# 更新并重启
docker compose -f docker-compose.saas.yml pull
docker compose -f docker-compose.saas.yml up -d
```

## 六、Nginx 反向代理 (可选)

如果要用域名访问，配置 Nginx：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
