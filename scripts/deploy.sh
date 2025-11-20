#!/bin/bash
# Deployment script for motiv-buy
# Usage: deploy.sh <environment>
# Where environment is: staging or production

set -euo pipefail

# ==========================================
# Configuration
# ==========================================

ENVIRONMENT="${1:-staging}"

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "❌ Invalid environment: $ENVIRONMENT"
  echo "Usage: $0 <staging|production>"
  exit 1
fi

# Environment-specific configuration
declare -A ENV_CONFIG

# Staging configuration
ENV_CONFIG[staging_NODE_ENV]="production"
ENV_CONFIG[staging_IMAGE_TAG]="staging"
ENV_CONFIG[staging_LOG_LEVEL]="debug"
ENV_CONFIG[staging_API_DOMAIN]="api.st.motivbuy.com"
ENV_CONFIG[staging_BOT_DOMAIN]="bot.st.motivbuy.com"
ENV_CONFIG[staging_MAIN_DOMAIN]="st.motivbuy.com"
ENV_CONFIG[staging_WAIT_TIMEOUT]="120"

# Production configuration
ENV_CONFIG[production_NODE_ENV]="production"
ENV_CONFIG[production_IMAGE_TAG]="latest"
ENV_CONFIG[production_LOG_LEVEL]="warn"
ENV_CONFIG[production_API_DOMAIN]="api.motivbuy.com"
ENV_CONFIG[production_BOT_DOMAIN]="bot.motivbuy.com"
ENV_CONFIG[production_MAIN_DOMAIN]="motivbuy.com"
ENV_CONFIG[production_WAIT_TIMEOUT]="180"

# Get configuration for current environment
get_config() {
  local key="${ENVIRONMENT}_${1}"
  echo "${ENV_CONFIG[$key]}"
}

# ==========================================
# Deployment Steps
# ==========================================

echo "🚀 Starting $ENVIRONMENT deployment..."

# Print deployment configuration
echo ""
echo "📋 Deployment Configuration:"
echo "  Environment:    $ENVIRONMENT"
echo "  VPS Host:       ${VPS_HOST}"
echo "  VPS User:       ${VPS_USER}"
echo "  Deploy Path:    ${VPS_DEPLOY_PATH}"
echo "  Docker Registry: ${DOCKER_REGISTRY}"
echo "  Image Tag:      $(get_config IMAGE_TAG)"
echo ""

# Step 0: Verify connectivity
echo "🔍 Verifying server connectivity..."
echo "  Testing network connectivity to ${VPS_HOST}..."
if ping -c 1 -W 5 "${VPS_HOST}" > /dev/null 2>&1; then
  echo "  ✅ Host is reachable via ping"
else
  echo "  ⚠️  Host not responding to ping (may be blocked by firewall)"
fi

echo "  Testing SSH port (22) on ${VPS_HOST}..."
if timeout 10 bash -c "cat < /dev/null > /dev/tcp/${VPS_HOST}/22" 2>/dev/null; then
  echo "  ✅ SSH port 22 is open and accepting connections"
else
  echo "  ❌ SSH port 22 is not accessible"
  echo ""
  echo "💡 Troubleshooting steps:"
  echo "  1. Verify the VPS_HOST value is correct in GitHub environment settings"
  echo "  2. Check if SSH service is running on the server: sudo systemctl status sshd"
  echo "  3. Check firewall rules: sudo ufw status"
  echo "  4. Verify server is online and accessible from your network"
  echo "  5. Check if the IP address ${VPS_HOST} is correct for ${ENVIRONMENT} environment"
  exit 1
fi

echo "  Testing SSH authentication..."
if ssh -o StrictHostKeyChecking=yes -o ConnectTimeout=10 -o BatchMode=yes \
  "${VPS_USER}@${VPS_HOST}" "echo 'SSH authentication successful'" 2>/dev/null; then
  echo "  ✅ SSH authentication successful"
else
  echo "  ❌ SSH authentication failed"
  echo ""
  echo "💡 Troubleshooting steps:"
  echo "  1. Verify VPS_SSH_KEY secret is set correctly in GitHub"
  echo "  2. Verify VPS_USER has the correct value for this environment"
  echo "  3. Check SSH key permissions on the server"
  exit 1
fi
echo ""

# Step 1: Create directories
echo "📁 Creating directory structure..."
ssh -o StrictHostKeyChecking=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=10 \
  -o TCPKeepAlive=yes \
  "${VPS_USER}@${VPS_HOST}" \
  "VPS_DEPLOY_PATH='${VPS_DEPLOY_PATH}'" \
  "VPS_USER='${VPS_USER}'" \
  bash << 'MKDIR_EOF'
set -euo pipefail

# Create main deployment directory
sudo mkdir -p ${VPS_DEPLOY_PATH}
sudo chown -R ${VPS_USER}:${VPS_USER} ${VPS_DEPLOY_PATH}
sudo chmod -R 755 ${VPS_DEPLOY_PATH}

# Create subdirectories
mkdir -p ${VPS_DEPLOY_PATH}/docker
mkdir -p ${VPS_DEPLOY_PATH}/config/nginx/sites-available
mkdir -p ${VPS_DEPLOY_PATH}/config/nginx/sites-enabled
mkdir -p ${VPS_DEPLOY_PATH}/config/nginx/ssl
mkdir -p ${VPS_DEPLOY_PATH}/config/prometheus
mkdir -p ${VPS_DEPLOY_PATH}/config/redis
mkdir -p ${VPS_DEPLOY_PATH}/config/nats
mkdir -p ${VPS_DEPLOY_PATH}/scripts

echo "✅ Directories created successfully"
MKDIR_EOF

# Step 2: Copy deployment files
echo "📄 Copying docker-compose file..."
scp -o StrictHostKeyChecking=yes docker-compose.production.yml \
  "${VPS_USER}@${VPS_HOST}:${VPS_DEPLOY_PATH}/docker-compose.yml"

# Copy required directories
for dir in docker config scripts; do
  if [ -d "$dir" ]; then
    echo "📁 Copying $dir directory..."
    tar czf - -C "$dir" . | ssh -o StrictHostKeyChecking=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=10 \
  -o TCPKeepAlive=yes \
      "${VPS_USER}@${VPS_HOST}" \
      "cd ${VPS_DEPLOY_PATH}/$dir && tar xzf -"
    echo "✅ $dir copied successfully"
  fi
done

# Step 3: Create environment file
echo "📝 Generating .env file..."
# Generate .env content locally to avoid SSH heredoc nesting issues
cat << EOF | ssh -o StrictHostKeyChecking=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=10 \
  -o TCPKeepAlive=yes \
  "${VPS_USER}@${VPS_HOST}" \
  "cat > ${VPS_DEPLOY_PATH}/.env && echo '✅ .env file created successfully'"
NODE_ENV=$(get_config NODE_ENV)
PROJECT_NAME=motiv-buy
ENV=$ENVIRONMENT
VPS_DEPLOY_PATH=${VPS_DEPLOY_PATH}
DOCKER_REGISTRY=${DOCKER_REGISTRY}
DOCKER_IMAGE_PREFIX=${DOCKER_IMAGE_PREFIX}
IMAGE_TAG=$(get_config IMAGE_TAG)
PORT=3000
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
REDIS_MODE=${REDIS_MODE}
REDIS_HOSTS=${REDIS_HOSTS}
REDIS_PASSWORD=${REDIS_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
CRYPTO_BOT_API_TOKEN=${CRYPTO_BOT_API_TOKEN}
LOG_LEVEL=$(get_config LOG_LEVEL)
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000
API_DOMAIN=$(get_config API_DOMAIN)
BOT_DOMAIN=$(get_config BOT_DOMAIN)
MAIN_DOMAIN=$(get_config MAIN_DOMAIN)
LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL}
API_PORT_EXTERNAL=3001
DB_PORT_EXTERNAL=5433
REDIS_PORT_EXTERNAL=6381
NATS_PORT_EXTERNAL=4223
NATS_MONITOR_PORT=8223
HTTP_PORT=80
HTTPS_PORT=443
PROMETHEUS_PORT=9090
GRAFANA_PORT=3002
GRAFANA_PASSWORD=${GRAFANA_PASSWORD}
NATS_USER=${NATS_USER}
NATS_PASSWORD=${NATS_PASSWORD}
EOF

# Step 3.5: Prepare NATS configuration
echo "🔐 Preparing NATS configuration with bcrypt password..."
ssh -o StrictHostKeyChecking=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=10 \
  -o TCPKeepAlive=yes \
  "${VPS_USER}@${VPS_HOST}" \
  "VPS_DEPLOY_PATH='${VPS_DEPLOY_PATH}'" \
  "NATS_USER='${NATS_USER}'" \
  "NATS_PASSWORD='${NATS_PASSWORD}'" \
  "ENV='${ENVIRONMENT}'" \
  bash << 'NATS_EOF'
set -euo pipefail
cd $VPS_DEPLOY_PATH

# Generate bcrypt hash from plaintext password
echo "Generating bcrypt hash from NATS_PASSWORD..."
NATS_BCRYPT_PASSWORD=$(echo "$NATS_PASSWORD" | docker run --rm -i httpd:alpine htpasswd -niB "" | cut -d: -f2)

# Escape $ characters for NATS config (NATS uses $ for variable substitution, so literal $ must be $$)
echo "Escaping bcrypt password for NATS config..."
NATS_BCRYPT_PASSWORD_ESCAPED="${NATS_BCRYPT_PASSWORD//\$/\$\$}"

# Generate NATS config directly with bash variable substitution (no sed escaping needed)
# This is more reliable than sed template substitution
mkdir -p config/nats
cat > "config/nats/nats-${ENV}-runtime.conf" << CONFIGEOF
# NATS ${ENV^} Configuration (auto-generated)
# This configuration uses bcrypt-hashed passwords for security

# Server settings
server_name: nats-${ENV}
port: 4222

# JetStream configuration
jetstream {
  store_dir: /data
  max_memory_store: 3GB
  max_file_store: 15GB
}

# HTTP Monitoring
http_port: 8222

# Logging
debug: false
trace: false
logtime: true

# Security: Authentication with bcrypt
authorization {
  user: $NATS_USER
  # Bcrypt hashed password (quoted to prevent variable substitution)
  password: "$NATS_BCRYPT_PASSWORD_ESCAPED"
}

# Additional security settings
max_connections: 500
max_control_line: 4096
max_payload: 1048576
ping_interval: 120s
ping_max: 3
CONFIGEOF

# Verify the file was created and has content
if [ ! -s "config/nats/nats-${ENV}-runtime.conf" ]; then
  echo "ERROR: Failed to create NATS configuration file"
  exit 1
fi

# Verify critical values are present (not empty)
if ! grep -q "user: $NATS_USER" "config/nats/nats-${ENV}-runtime.conf"; then
  echo "ERROR: NATS_USER not found in config"
  exit 1
fi

if ! grep -q "password: \"$NATS_BCRYPT_PASSWORD_ESCAPED\"" "config/nats/nats-${ENV}-runtime.conf"; then
  echo "ERROR: NATS_BCRYPT_PASSWORD_ESCAPED not substituted in config"
  exit 1
fi

echo "✅ NATS configuration generated and verified successfully"
NATS_EOF

# Step 4: Execute remote deployment script
echo "🐳 Executing remote deployment script..."
WAIT_TIMEOUT="$(get_config WAIT_TIMEOUT)"

# Execute the deploy-remote.sh script on the server with all required environment variables
ssh -o StrictHostKeyChecking=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=10 \
  -o TCPKeepAlive=yes \
  "${VPS_USER}@${VPS_HOST}" \
  "export GITHUB_TOKEN='${GITHUB_TOKEN}' && \
   export WAIT_TIMEOUT='${WAIT_TIMEOUT}' && \
   export VPS_DEPLOY_PATH='${VPS_DEPLOY_PATH}' && \
   export DOCKER_REGISTRY='${DOCKER_REGISTRY}' && \
   export GITHUB_ACTOR='${GITHUB_ACTOR}' && \
   export ENV='${ENVIRONMENT}' && \
   export REDIS_PASSWORD='${REDIS_PASSWORD}' && \
   cd ${VPS_DEPLOY_PATH} && \
   bash scripts/deploy-remote.sh"

if [ $? -ne 0 ]; then
  echo "❌ Remote deployment script failed"
  exit 1
fi

echo "✅ Remote deployment completed successfully"

# Step 5: External health verification
echo "🏥 Running external health verification..."
ssh -o StrictHostKeyChecking=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=10 \
  -o TCPKeepAlive=yes \
  "${VPS_USER}@${VPS_HOST}" \
  "VPS_DEPLOY_PATH='${VPS_DEPLOY_PATH}'" \
  "API_PORT_EXTERNAL='${API_PORT_EXTERNAL:-3000}'" \
  bash << 'HEALTH_EOF'
set -euo pipefail
cd $VPS_DEPLOY_PATH

echo "Checking API health endpoint..."
# Try health check with retries
for i in {1..10}; do
  if curl -sf http://localhost:${API_PORT_EXTERNAL}/health > /dev/null 2>&1; then
    echo "✅ External health check passed"
    echo "API is accessible on port ${API_PORT_EXTERNAL}"
    exit 0
  fi
  echo "  Attempt $i/10 failed, retrying..."
  sleep 3
done

echo "❌ External health check failed after 10 attempts"
echo "Container status:"
docker compose ps
echo ""
echo "API logs:"
docker compose logs --tail=100 api
exit 1
HEALTH_EOF

# Step 6: Smoke tests (production only)
if [[ "$ENVIRONMENT" == "production" ]]; then
  echo "🧪 Running smoke tests..."
  ssh -o StrictHostKeyChecking=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=10 \
  -o TCPKeepAlive=yes \
    "${VPS_USER}@${VPS_HOST}" \
    "VPS_DEPLOY_PATH='${VPS_DEPLOY_PATH}'" \
    "API_PORT_EXTERNAL='${API_PORT_EXTERNAL:-3000}'" \
    bash << 'SMOKE_EOF'
  set -euo pipefail
  cd $VPS_DEPLOY_PATH

  echo "Testing API endpoints..."
  if curl -sf http://localhost:${API_PORT_EXTERNAL}/health > /dev/null && \
     curl -sf http://localhost:${API_PORT_EXTERNAL}/api > /dev/null 2>&1; then
    echo "✅ Smoke tests passed"
  else
    echo "⚠️  Some smoke tests failed (non-critical)"
  fi
SMOKE_EOF
fi

# Step 7: Deployment summary
echo ""
echo "======================================"
echo "✅ $ENVIRONMENT DEPLOYMENT COMPLETED"
echo "======================================"
ssh -o StrictHostKeyChecking=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=10 \
  -o TCPKeepAlive=yes \
  "${VPS_USER}@${VPS_HOST}" \
  "VPS_DEPLOY_PATH='${VPS_DEPLOY_PATH}'" \
  bash << 'SUMMARY_EOF'
cd $VPS_DEPLOY_PATH
echo ""
echo "Service Status:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Recent Logs (last 5 lines per service):"
echo "--- API ---"
docker compose logs --tail=5 api 2>/dev/null || echo "No logs"
echo "--- Bot ---"
docker compose logs --tail=5 bot 2>/dev/null || echo "No logs"
SUMMARY_EOF

echo ""
echo "Deployment completed at $(date)"
echo "======================================"
