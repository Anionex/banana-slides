#!/bin/bash
# Generic environment variable replacement script
# Automatically replaces configuration items in .env file from GitHub Secrets or environment variables
#
# Usage:
#   ./scripts/setup-env-from-secrets.sh

set -e

ENV_FILE="${1:-.env}"
ENV_EXAMPLE="${2:-.env.example}"

echo "Setting up environment variables..."
echo "   Source file: $ENV_EXAMPLE"
echo "   Target file: $ENV_FILE"
echo ""

# Copy .env.example to .env
cp "$ENV_EXAMPLE" "$ENV_FILE"

# Define list of configuration items to be replaced from environment variables/Secrets
# Format: configuration item name
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
  "BACKEND_PORT"
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

# Iterate through each configuration item
for var_name in "${REPLACEABLE_VARS[@]}"; do
  # Get the value of the environment variable (if exists)
  var_value="${!var_name}"
  
    # If environment variable exists and is not empty, replace it
  if [ -n "$var_value" ]; then
    # Check if this configuration item exists in .env file
    if grep -q "^${var_name}=" "$ENV_FILE"; then
      # Escape special characters for sed replacement string (RHS)
      escaped_value=$(printf '%s\n' "$var_value" | sed -e 's/[\/&]/\\&/g')
      # Use sed to replace the entire line (handles special characters)
      # Use | as delimiter to support values with / like URLs
      sed -i "s|^${var_name}=.*|${var_name}=${escaped_value}|" "$ENV_FILE"
      echo "Replaced ${var_name}"
      replaced_count=$((replaced_count + 1))
    else
      echo "Warning: ${var_name} does not exist in .env file, skipping"
    fi
  else
    # Environment variable does not exist, keep default value
    skipped_count=$((skipped_count + 1))
  fi
done

# Special handling: If GOOGLE_API_KEY is not configured, use mock-api-key
if [ -z "${GOOGLE_API_KEY}" ]; then
  sed -i '/^GOOGLE_API_KEY=/s/your-api-key-here/mock-api-key/' "$ENV_FILE"
  echo "Warning: GOOGLE_API_KEY using mock-api-key (not configured)"
fi

echo ""
echo "Configuration complete:"
echo "   Replaced: $replaced_count items"
echo "   Using defaults: $skipped_count items"
echo ""

