#!/bin/bash
# 通用环境变量替换脚本
# 自动从GitHub Secrets或环境变量替换.env文件中的配置项
#
# 使用方式：
#   ./scripts/setup-env-from-secrets.sh

set -e

ENV_FILE="${1:-.env}"
ENV_EXAMPLE="${2:-.env.example}"

echo "📋 开始配置环境变量..."
echo "   源文件: $ENV_EXAMPLE"
echo "   目标文件: $ENV_FILE"
echo ""

# 复制.env.example到.env
cp "$ENV_EXAMPLE" "$ENV_FILE"

# 定义需要从环境变量/Secrets替换的配置项列表
# 格式：配置项名称
REPLACEABLE_VARS=(
  "AI_PROVIDER_FORMAT"
  "GOOGLE_API_KEY"
  "GOOGLE_API_BASE"
  "OPENAI_API_KEY"
  "OPENAI_API_BASE"
  "OPENAI_TIMEOUT"
  "OPENAI_MAX_RETRIES"
  "TEXT_MODEL"
  "IMAGE_MODEL"
  "LOG_LEVEL"
  "FLASK_ENV"
  "SECRET_KEY"
  "PORT"
  "CORS_ORIGINS"
  "MAX_DESCRIPTION_WORKERS"
  "MAX_IMAGE_WORKERS"
  "MINERU_TOKEN"
  "MINERU_API_BASE"
  "IMAGE_CAPTION_MODEL"
  "OUTPUT_LANGUAGE"
)

replaced_count=0
skipped_count=0

# 遍历每个配置项
for var_name in "${REPLACEABLE_VARS[@]}"; do
  # 获取环境变量的值（如果存在）
  var_value="${!var_name}"
  
  # 如果环境变量存在且非空，则替换
  if [ -n "$var_value" ]; then
    # 检查.env文件中是否存在这个配置项
    if grep -q "^${var_name}=" "$ENV_FILE"; then
      # 使用sed替换整行（处理特殊字符）
      # 使用|作为分隔符以支持URL等包含/的值
      sed -i "s|^${var_name}=.*|${var_name}=${var_value}|" "$ENV_FILE"
      echo "✓ 已替换 ${var_name}"
      ((replaced_count++))
    else
      echo "⚠ 配置项 ${var_name} 在.env文件中不存在，跳过"
    fi
  else
    # 环境变量不存在，保持默认值
    ((skipped_count++))
  fi
done

# 特殊处理：GOOGLE_API_KEY如果没有配置，使用mock-api-key
if [ -z "${GOOGLE_API_KEY}" ]; then
  sed -i '/^GOOGLE_API_KEY=/s/your-api-key-here/mock-api-key/' "$ENV_FILE"
  echo "⚠ GOOGLE_API_KEY 使用 mock-api-key（未配置）"
fi

echo ""
echo "📊 配置完成："
echo "   已替换: $replaced_count 个配置项"
echo "   使用默认值: $skipped_count 个配置项"
echo ""

