# Banana Slides SaaS 部署运维指南

## 一、架构概览

```
┌─────────────┐     push      ┌──────────────────┐     build     ┌─────────────┐
│   开发者     │ ──────────►  │  GitHub Actions  │ ────────────► │  Docker Hub │
└─────────────┘               └──────────────────┘               └─────────────┘
                                      │                                 │
                                      │ SSH                             │ pull
                                      ▼                                 ▼
                              ┌──────────────────────────────────────────────┐
                              │              生产服务器                        │
                              │  ┌─────────────────┐  ┌─────────────────┐   │
                              │  │  Backend :5001  │  │ Frontend :3001  │   │
                              │  │  (Flask+SQLite) │  │    (Nginx)      │   │
                              │  └─────────────────┘  └─────────────────┘   │
                              └──────────────────────────────────────────────┘
```

## 二、服务信息

| 服务 | 端口 | 容器名 | 镜像 |
|------|------|--------|------|
| 前端 | 3001 | banana-slides-frontend-saas | anoinex/banana-slides-frontend:saas |
| 后端 | 5001 | banana-slides-backend-saas | anoinex/banana-slides-backend:saas |

**访问地址：**
- 前端: http://<服务器IP>:3001
- 后端 API: http://<服务器IP>:5001

## 三、自动部署 (CD)

### 触发条件
- 推送到 `main` 分支自动触发
- 可在 GitHub Actions 页面手动触发

### 部署流程
1. GitHub Actions 构建 Docker 镜像
2. 推送镜像到 Docker Hub (tag: `saas`)
3. SSH 连接服务器
4. 拉取最新镜像并重启容器

### 触发部署
```bash
git add .
git commit -m "your changes"
git push origin main
```

### 查看部署状态
```bash
# 查看最近的 workflow
gh run list --limit 5

# 查看具体运行日志
gh run view <run_id> --log

# 查看失败日志
gh run view <run_id> --log-failed
```

## 四、服务器运维

### SSH 连接
```bash
ssh root@<服务器IP>
```

### 查看服务状态
```bash
cd /opt/banana-slides
docker compose -p banana-saas -f docker-compose.saas.yml ps
```

### 查看日志
```bash
# 后端日志 (最后50行)
docker logs banana-slides-backend-saas --tail 50

# 实时跟踪后端日志
docker logs banana-slides-backend-saas -f

# 前端日志
docker logs banana-slides-frontend-saas --tail 50

# 同时查看两个服务
docker compose -p banana-saas -f docker-compose.saas.yml logs -f
```

### 重启服务
```bash
cd /opt/banana-slides

# 重启所有服务
docker compose -p banana-saas -f docker-compose.saas.yml restart

# 只重启后端
docker compose -p banana-saas -f docker-compose.saas.yml restart backend

# 完全重建 (down + up)
docker compose -p banana-saas -f docker-compose.saas.yml down
docker compose -p banana-saas -f docker-compose.saas.yml up -d
```

### 手动更新镜像
```bash
cd /opt/banana-slides

# 拉取最新镜像
docker pull anoinex/banana-slides-backend:saas
docker pull anoinex/banana-slides-frontend:saas

# 重启服务
docker compose -p banana-saas -f docker-compose.saas.yml up -d
```

## 五、配置管理

### 环境变量
配置文件位置: `/opt/banana-slides/.env`

```bash
# 编辑配置
nano /opt/banana-slides/.env

# 修改后重启生效
docker compose -p banana-saas -f docker-compose.saas.yml restart backend
```

### 关键配置项
```bash
# AI 服务
AI_PROVIDER_FORMAT=gemini
GOOGLE_API_KEY=your_api_key
GOOGLE_API_BASE=https://aihubmix.com/gemini
TEXT_MODEL=gemini-3-flash-preview
IMAGE_MODEL=gemini-3-pro-image-preview

# SaaS 认证
JWT_SECRET_KEY=your_jwt_secret

# 邮件验证
RESEND_API_KEY=re_xxxxx
```

## 六、数据管理

### 数据目录
```
/opt/banana-slides/
├── .env                    # 环境配置
├── docker-compose.saas.yml # Docker 配置
└── data/
    ├── instance/           # SQLite 数据库
    │   └── database.db
    └── uploads/            # 用户上传文件
```

### 数据库操作
```bash
# 查看用户列表
sqlite3 /opt/banana-slides/data/instance/database.db "SELECT email, is_admin, credits_balance FROM users;"

# 设置用户为管理员
sqlite3 /opt/banana-slides/data/instance/database.db "UPDATE users SET is_admin=1 WHERE email='xxx@example.com';"

# 给用户加积分
sqlite3 /opt/banana-slides/data/instance/database.db "UPDATE users SET credits_balance=credits_balance+1000 WHERE email='xxx@example.com';"
```

### 数据备份
```bash
# 备份数据库
cp /opt/banana-slides/data/instance/database.db /backup/database_$(date +%Y%m%d).db

# 备份上传文件
tar -czf /backup/uploads_$(date +%Y%m%d).tar.gz /opt/banana-slides/data/uploads/
```

## 七、GitHub Secrets 配置

在 GitHub 仓库 Settings > Secrets and variables > Actions 中配置：

| Secret | 说明 |
|--------|------|
| `DOCKERHUB_USERNAME` | Docker Hub 用户名 (anoinex) |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token |
| `SERVER_HOST` | 服务器 IP |
| `SERVER_USER` | SSH 用户名 (root) |
| `SERVER_SSH_KEY` | SSH 私钥 |

## 八、常见问题

### 部署失败: Docker Hub 认证错误
```
unauthorized: incorrect username or password
```
**解决:** 检查 `DOCKERHUB_USERNAME` 和 `DOCKERHUB_TOKEN` 是否正确

### 后端一直重启
```bash
# 查看日志找原因
docker logs banana-slides-backend-saas --tail 100
```
常见原因: 数据库迁移问题、环境变量缺失

### 邮件发送失败
检查 `.env` 中 `RESEND_API_KEY` 是否配置

### 容器内存不足
```bash
# 查看资源使用
docker stats

# 清理无用镜像
docker image prune -a
```

## 九、监控建议

### 健康检查
```bash
# 检查后端健康
curl http://localhost:5001/health

# 检查前端
curl -I http://localhost:3001
```

### 定时任务 (可选)
```bash
# 添加 crontab 定时备份
crontab -e

# 每天凌晨3点备份数据库
0 3 * * * cp /opt/banana-slides/data/instance/database.db /backup/database_$(date +\%Y\%m\%d).db
```
