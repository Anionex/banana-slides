# 腾讯云部署指南

服务器：腾讯云轻量应用服务器，2核2GB，Ubuntu 22.04，Docker 26
架构：单 Docker 容器（nginx + supervisor + Flask，allinone 模式）

---

## 首次部署

### 1. 腾讯云控制台：开放端口

登录腾讯云控制台 → 轻量应用服务器 → 防火墙，添加规则：
- 端口 80（HTTP）：允许所有来源

### 2. 本地机器：推送 deploy/tencent 分支

```bash
git checkout deploy/tencent
git push -u origin deploy/tencent
```

### 3. SSH 登录服务器

```bash
ssh -i /path/to/ting_20260403.pem ubuntu@<YOUR_SERVER_IP>
```

> .pem 文件只保存在本地，绝对不要提交到 git。

### 4. 服务器：安装前置依赖

```bash
sudo apt update && sudo apt install -y git sqlite3
# Docker 26 已预装，无需安装
```

### 5. 服务器：克隆仓库（deploy/tencent 分支）

```bash
sudo mkdir -p /srv/banana-slides
sudo chown ubuntu:ubuntu /srv/banana-slides
git clone --branch deploy/tencent https://github.com/XintongTing/banana-slides.git /srv/banana-slides
cd /srv/banana-slides
```

### 6. 服务器：创建数据目录

```bash
sudo mkdir -p /data/banana-slides/db /data/banana-slides/uploads
sudo chown -R ubuntu:ubuntu /data/banana-slides
sudo mkdir -p /data/backups/banana-slides
```

### 7. 服务器：创建 .env 配置文件

```bash
cp deploy/.env.tencent deploy/.env
nano deploy/.env
```

必须填写的项：
- `SECRET_KEY`：用 `python3 -c "import secrets; print(secrets.token_hex(32))"` 生成
- 至少一个 AI 服务商的 API Key（`GOOGLE_API_KEY` 或 `OPENAI_API_KEY` 等）
- 将 `AI_PROVIDER_FORMAT` 设置为对应的服务商

### 8. 服务器：执行部署

```bash
bash deploy/scripts/deploy.sh
```

首次构建约需 5-10 分钟（下载基础镜像、安装依赖）。

### 9. 验证部署

```bash
curl http://<YOUR_SERVER_IP>/health
# 预期返回: {"status": "ok"} 或类似内容
```

浏览器访问 `http://<YOUR_SERVER_IP>` 即可使用。

---

## 日常更新（同步上游新功能）

### 第一步：本地机器同步上游

```bash
# 在本地仓库根目录执行
bash deploy/scripts/sync-upstream.sh
```

该脚本会自动：
1. 拉取 upstream/main 最新代码
2. 合并到 origin/main
3. 将 deploy/tencent rebase 到最新 main
4. 推送两个分支到 origin

### 第二步：服务器拉取并重新部署

```bash
ssh -i /path/to/ting_20260403.pem ubuntu@<YOUR_SERVER_IP>
cd /srv/banana-slides
git pull origin deploy/tencent
bash deploy/scripts/deploy.sh
```

> 重新部署不会丢失数据，数据存储在 `/data/banana-slides/` 宿主机目录，与容器生命周期无关。

---

## 备份与恢复

### 手动备份

```bash
bash deploy/scripts/backup.sh
```

### 设置每日自动备份（在服务器上执行）

```bash
crontab -e
# 添加以下行（每天凌晨 3 点执行）：
0 3 * * * /srv/banana-slides/deploy/scripts/backup.sh >> /data/backups/backup.log 2>&1
```

### 从备份恢复

```bash
# 停止容器
docker stop banana-slides

# 恢复数据库
cp /data/backups/banana-slides/<TIMESTAMP>/database.db /data/banana-slides/db/database.db

# 恢复上传文件
tar -xzf /data/backups/banana-slides/<TIMESTAMP>/uploads.tar.gz -C /data/banana-slides/

# 重启容器
cd /srv/banana-slides
docker compose -f deploy/docker-compose.tencent.yml --env-file deploy/.env up -d
```

---

## 常用运维命令

```bash
# 查看实时日志
docker logs banana-slides -f

# 查看容器健康状态
docker inspect --format='{{.State.Health.Status}}' banana-slides

# 进入容器内部排查问题
docker exec -it banana-slides bash

# 查看磁盘使用
df -h /data

# 查看内存使用
free -h

# 查看容器资源占用
docker stats banana-slides

# 手动重启容器（不重新构建）
docker compose -f deploy/docker-compose.tencent.yml --env-file deploy/.env restart
```

---

## 分支策略说明

```
upstream/main  ──●──●──●──────────────────────────
                          \
origin/main    ────────────●──●──●────────────────
                                    \
deploy/tencent ─────────────────────●── (仅 deploy/ 目录)
```

- `deploy/` 目录在 `main` 分支中被 gitignore，上游合并永远不会产生冲突
- `deploy/tencent` 分支只新增 `deploy/` 目录，从不修改任何源码文件
- 每次上游有更新，运行 `sync-upstream.sh` 即可完成同步，rebase 无冲突

---

## 故障排查

**容器启动失败**
```bash
docker logs banana-slides --tail 100
```

**健康检查失败**
```bash
# 检查端口是否监听
docker exec banana-slides curl -s http://localhost/health
# 检查腾讯云防火墙是否开放了 80 端口
```

**内存不足**
```bash
free -h
docker stats banana-slides
# 如果内存持续接近上限，考虑降低 MAX_IMAGE_WORKERS 和 MAX_DESCRIPTION_WORKERS
```

**数据库锁定**
```bash
# 检查 WAL 文件是否异常
ls -la /data/banana-slides/db/
# 正常情况下会有 database.db, database.db-wal, database.db-shm
```
