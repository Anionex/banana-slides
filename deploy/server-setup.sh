#!/bin/bash
# deploy/server-setup.sh - 服务器初始化脚本
# 在远程服务器上运行一次

set -e

DEPLOY_DIR="/opt/banana-slides"

echo "🚀 Setting up Banana Slides SaaS deployment..."

# 创建部署目录
sudo mkdir -p $DEPLOY_DIR
sudo chown $USER:$USER $DEPLOY_DIR
cd $DEPLOY_DIR

# 创建数据目录
mkdir -p data/instance data/uploads

# 下载 docker-compose 配置
curl -fsSL https://raw.githubusercontent.com/Anionex/banana-slides-saas/feat/saas/docker-compose.saas.yml -o docker-compose.saas.yml

# 创建 .env 文件模板
if [ ! -f .env ]; then
cat > .env << 'EOF'
# AI Provider 配置
AI_PROVIDER_FORMAT=gemini
GOOGLE_API_KEY=your_google_api_key_here
# 或者使用 OpenAI
# AI_PROVIDER_FORMAT=openai
# OPENAI_API_KEY=your_openai_api_key_here

# 模型配置
TEXT_MODEL=gemini-2.0-flash
IMAGE_MODEL=imagen-3.0-generate-002

# SaaS 配置
SECRET_KEY=your_secret_key_here_change_this
JWT_SECRET_KEY=your_jwt_secret_key_here_change_this

# 邮件配置 (可选)
# MAIL_SERVER=smtp.example.com
# MAIL_PORT=587
# MAIL_USERNAME=your_email
# MAIL_PASSWORD=your_password

# 支付配置 (可选)
# XUNHUPAY_APP_ID=your_app_id
# XUNHUPAY_APP_SECRET=your_app_secret
EOF

echo "📝 Created .env template. Please edit it with your configuration:"
echo "   nano $DEPLOY_DIR/.env"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys: nano $DEPLOY_DIR/.env"
echo "2. Start the services: docker compose -f docker-compose.saas.yml up -d"
echo "3. Check status: docker compose -f docker-compose.saas.yml ps"
echo ""
echo "Services will be available at:"
echo "  - Frontend: http://your-server:3001"
echo "  - Backend:  http://your-server:5001"
