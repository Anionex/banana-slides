# Coolify 生产部署指南

## 📋 前提条件

1. 已安装 Coolify 并配置好服务器
2. 连接 GitHub 仓库到 Coolify
3. 有一个可用的域名（如 `slides.example.com`）

## 🔧 部署方式选择

### 方式 A: Docker Compose 部署（推荐）

Coolify 支持直接使用 `docker-compose.yml` 部署。

1. 在 Coolify 中创建新项目
2. 选择 **Docker Compose** 部署类型
3. 连接 GitHub 仓库
4. 配置环境变量（见下方）

### 方式 B: 分别部署前后端

如果需要更细粒度的控制，可以分别部署前后端服务。

---

## 🔐 必须配置的环境变量

在 Coolify 的环境变量设置中添加以下配置：

```env
# ============== 必须配置 ==============

# Google Gemini API（用户也可以在设置页面自己配置）
GOOGLE_API_KEY=your-production-google-api-key
GOOGLE_API_BASE=https://generativelanguage.googleapis.com

# Flask 安全密钥（必须修改！）
SECRET_KEY=your-very-long-random-secret-key-for-production

# JWT 密钥（必须修改！）
JWT_SECRET_KEY=another-very-long-random-secret-key-for-jwt

# 加密密钥（用于加密用户的 API Key，必须修改！）
# 生成命令: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=your-fernet-encryption-key

# CORS 配置（填写你的前端域名）
CORS_ORIGINS=https://slides.example.com

# 前端构建时的 API 地址
VITE_API_BASE_URL=https://slides.example.com

# OAuth 回调地址（根据你的域名修改）
BACKEND_URL=https://slides.example.com
OAUTH_REDIRECT_BASE=https://slides.example.com

# ============== 邮件服务 ==============

MAIL_SERVER=smtp.exmail.qq.com
MAIL_PORT=465
MAIL_USE_SSL=true
MAIL_USE_TLS=false
MAIL_USERNAME=support@your-domain.com
MAIL_PASSWORD=your-email-password
MAIL_DEFAULT_SENDER=蕉幻 Banana Slides <support@your-domain.com>

# ============== OAuth（可选） ==============

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# ============== 其他配置 ==============

# 日志级别
LOG_LEVEL=INFO
FLASK_ENV=production

# 并发配置
MAX_DESCRIPTION_WORKERS=5
MAX_IMAGE_WORKERS=8

# MinerU 文件解析服务（可选）
MINERU_TOKEN=your-mineru-token
MINERU_API_BASE=https://mineru.net
```

---

## 🔑 生成安全密钥

```bash
# 生成 SECRET_KEY / JWT_SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(64))"

# 生成 ENCRYPTION_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## 🌐 域名和 SSL 配置

### Coolify 自动配置

Coolify 会自动为你配置：
- Let's Encrypt SSL 证书
- 反向代理
- 健康检查

### 注意事项

1. **域名绑定**：在 Coolify 中将域名绑定到前端服务（nginx 容器）
2. **端口映射**：前端服务应该暴露 80 端口，由 Coolify 代理到 443
3. **内部通信**：后端不需要暴露到外网，前端 nginx 会通过 Docker 网络代理

---

## 📁 持久化存储

确保在 Coolify 中配置持久化卷：

```yaml
volumes:
  # SQLite 数据库
  - /data/banana-slides/instance:/app/backend/instance
  # 用户上传的文件
  - /data/banana-slides/uploads:/app/uploads
```

---

## 🔄 OAuth 回调配置

如果使用 Google/GitHub 登录，需要在 OAuth 应用中配置回调 URL：

### Google OAuth
- 回调 URL: `https://slides.example.com/api/auth/google/callback`

### GitHub OAuth
- 回调 URL: `https://slides.example.com/api/auth/github/callback`

---

## ✅ 部署检查清单

- [ ] 配置所有必须的环境变量
- [ ] 生成并设置安全密钥（SECRET_KEY, JWT_SECRET_KEY, ENCRYPTION_KEY）
- [ ] 配置邮件服务（注册验证、密码重置）
- [ ] 配置 CORS_ORIGINS 为你的域名
- [ ] 配置 BACKEND_URL 和 OAUTH_REDIRECT_BASE
- [ ] 配置 VITE_API_BASE_URL
- [ ] 设置持久化存储卷
- [ ] 配置 OAuth 回调 URL（如果使用第三方登录）
- [ ] 测试健康检查端点 `/health`
- [ ] 测试用户注册和登录流程

---

## 🐛 常见问题

### 1. CORS 错误
确保 `CORS_ORIGINS` 包含你的前端域名（带 https）

### 2. OAuth 回调失败
检查 `BACKEND_URL` 和 OAuth 应用中配置的回调 URL 是否一致

### 3. 邮件发送失败
检查 SMTP 配置，腾讯企业邮箱可能需要使用客户端专用密码

### 4. 上传文件丢失
确保配置了持久化存储卷

### 5. SQLite 数据丢失
生产环境建议使用 PostgreSQL，或确保数据库文件持久化

---

## 📊 生产环境建议

### 数据库升级（可选）

当前使用 SQLite，对于高并发场景建议升级到 PostgreSQL：

1. 添加 PostgreSQL 服务到 docker-compose
2. 修改 `DATABASE_URI` 环境变量
3. 运行数据库迁移

### 日志和监控

Coolify 提供内置的日志查看功能，也可以配置外部日志服务。

### 备份策略

定期备份：
- `/app/backend/instance/database.db` - 数据库
- `/app/uploads` - 用户上传的文件
