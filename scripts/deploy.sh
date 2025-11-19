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
ENV_CONFIG[staging_NODE_ENV]="staging"
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
      "${VPS_USER}@${VPS_HOST}" \
      "cd ${VPS_DEPLOY_PATH}/$dir && tar xzf -"
    echo "✅ $dir copied successfully"
  fi
done

# Step 3: Create environment file
echo "📝 Generating .env file..."
ssh -o StrictHostKeyChecking=yes \
  "${VPS_USER}@${VPS_HOST}" \
  "NODE_ENV='$(get_config NODE_ENV)'" \
  "PROJECT_NAME='motiv-buy'" \
  "ENV='$ENVIRONMENT'" \
  "VPS_DEPLOY_PATH='${VPS_DEPLOY_PATH}'" \
  "DOCKER_REGISTRY='${DOCKER_REGISTRY}'" \
  "DOCKER_IMAGE_PREFIX='${DOCKER_IMAGE_PREFIX}'" \
  "IMAGE_TAG='$(get_config IMAGE_TAG)'" \
  "PORT='3000'" \
  "DB_NAME='${DB_NAME}'" \
  "DB_USER='${DB_USER}'" \
  "DB_PASSWORD='${DB_PASSWORD}'" \
  "REDIS_PASSWORD='${REDIS_PASSWORD}'" \
  "JWT_SECRET='${JWT_SECRET}'" \
  "JWT_EXPIRES_IN='7d'" \
  "TELEGRAM_BOT_TOKEN='${TELEGRAM_BOT_TOKEN}'" \
  "CRYPTO_BOT_API_TOKEN='${CRYPTO_BOT_API_TOKEN}'" \
  "LOG_LEVEL='$(get_config LOG_LEVEL)'" \
  "RATE_LIMIT_MAX='100'" \
  "RATE_LIMIT_WINDOW='900000'" \
  "API_DOMAIN='$(get_config API_DOMAIN)'" \
  "BOT_DOMAIN='$(get_config BOT_DOMAIN)'" \
  "MAIN_DOMAIN='$(get_config MAIN_DOMAIN)'" \
  "LETSENCRYPT_EMAIL='${LETSENCRYPT_EMAIL}'" \
  "API_PORT_EXTERNAL='3001'" \
  "DB_PORT_EXTERNAL='5433'" \
  "REDIS_PORT_EXTERNAL='6381'" \
  "NATS_PORT_EXTERNAL='4223'" \
  "NATS_MONITOR_PORT='8223'" \
  "HTTP_PORT='80'" \
  "HTTPS_PORT='443'" \
  "PROMETHEUS_PORT='9090'" \
  "GRAFANA_PORT='3002'" \
  "GRAFANA_PASSWORD='${GRAFANA_PASSWORD}'" \
  "NATS_USER='${NATS_USER}'" \
  "NATS_PASSWORD='${NATS_PASSWORD}'" \
  bash << 'ENV_EOF'
set -euo pipefail
# Generate .env file with proper escaping
cat > $VPS_DEPLOY_PATH/.env << ENVFILE
NODE_ENV=${NODE_ENV}
PROJECT_NAME=${PROJECT_NAME}
ENV=${ENV}
VPS_DEPLOY_PATH=${VPS_DEPLOY_PATH}
DOCKER_REGISTRY=${DOCKER_REGISTRY}
DOCKER_IMAGE_PREFIX=${DOCKER_IMAGE_PREFIX}
IMAGE_TAG=${IMAGE_TAG}
PORT=${PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=${JWT_EXPIRES_IN}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
CRYPTO_BOT_API_TOKEN=${CRYPTO_BOT_API_TOKEN}
LOG_LEVEL=${LOG_LEVEL}
RATE_LIMIT_MAX=${RATE_LIMIT_MAX}
RATE_LIMIT_WINDOW=${RATE_LIMIT_WINDOW}
API_DOMAIN=${API_DOMAIN}
BOT_DOMAIN=${BOT_DOMAIN}
MAIN_DOMAIN=${MAIN_DOMAIN}
LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL}
API_PORT_EXTERNAL=${API_PORT_EXTERNAL}
DB_PORT_EXTERNAL=${DB_PORT_EXTERNAL}
REDIS_PORT_EXTERNAL=${REDIS_PORT_EXTERNAL}
NATS_PORT_EXTERNAL=${NATS_PORT_EXTERNAL}
NATS_MONITOR_PORT=${NATS_MONITOR_PORT}
HTTP_PORT=${HTTP_PORT}
HTTPS_PORT=${HTTPS_PORT}
PROMETHEUS_PORT=${PROMETHEUS_PORT}
GRAFANA_PORT=${GRAFANA_PORT}
GRAFANA_PASSWORD=${GRAFANA_PASSWORD}
NATS_USER=${NATS_USER}
NATS_PASSWORD=${NATS_PASSWORD}
ENVFILE
echo "✅ .env file created successfully"
ENV_EOF

# Step 3.5: Prepare NATS configuration
echo "🔐 Preparing NATS configuration with bcrypt password..."
ssh -o StrictHostKeyChecking=yes \
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

# Step 4: Deploy services
echo "🐳 Deploying Docker services..."
WAIT_TIMEOUT="$(get_config WAIT_TIMEOUT)"

ssh -o StrictHostKeyChecking=yes \
  "${VPS_USER}@${VPS_HOST}" \
  "GITHUB_TOKEN='${GITHUB_TOKEN}'" \
  "WAIT_TIMEOUT='${WAIT_TIMEOUT}'" \
  "VPS_DEPLOY_PATH='${VPS_DEPLOY_PATH}'" \
  "DOCKER_REGISTRY='${DOCKER_REGISTRY}'" \
  "GITHUB_ACTOR='${GITHUB_ACTOR}'" \
  "ENV='${ENVIRONMENT}'" \
  bash << 'DEPLOY_EOF'
set -euo pipefail
cd $VPS_DEPLOY_PATH

# Create data directories if they don't exist
mkdir -p data/postgres data/redis data/nats \
         data/nginx/logs \
         data/api/logs data/api/uploads data/api/temp \
         data/bot/logs data/bot/temp data/bot/sessions \
         data/prometheus data/grafana

# Login to Docker registry
echo "$GITHUB_TOKEN" | docker login $DOCKER_REGISTRY -u $GITHUB_ACTOR --password-stdin

# Pull latest images
docker compose pull

# Strategy for zero-downtime deployment:
# 1. Update data services (postgres, redis) - no restart unless image changed
# 2. Update NATS with new config (fast restart, apps will reconnect)
# 3. Update application services with new images

echo "📦 Updating data services (postgres, redis)..."
docker compose up -d --no-deps postgres redis

echo "🔄 Recreating NATS with new config (apps will auto-reconnect)..."
docker compose up -d --force-recreate --no-deps nats

# Wait for NATS to be ready (fast, usually < 2 seconds)
echo "⏳ Waiting for NATS to start..."
sleep 2

# Deploy application services with zero-downtime rolling update
# Apps have restart: unless-stopped and will reconnect to NATS automatically
echo "🚀 Deploying application services with zero-downtime..."
docker compose up -d --no-deps api bot

# Deploy nginx last
echo "🌐 Updating nginx..."
docker compose up -d --no-deps nginx

# Final health check with timeout
echo "🏥 Verifying all services are healthy..."
docker compose up -d --remove-orphans --wait --wait-timeout $WAIT_TIMEOUT
echo "✅ Deployment completed"

# Cleanup old images
if [[ "$ENV" == "production" ]]; then
  docker image prune -af --filter 'until=48h'
else
  docker image prune -af --filter 'until=24h'
fi
DEPLOY_EOF

# Step 5: Health check
echo "🏥 Running health checks..."
ssh -o StrictHostKeyChecking=yes \
  "${VPS_USER}@${VPS_HOST}" \
  "VPS_DEPLOY_PATH='${VPS_DEPLOY_PATH}'" \
  "WAIT_TIMEOUT='${WAIT_TIMEOUT}'" \
  bash << 'HEALTH_EOF'
set -euo pipefail
cd $VPS_DEPLOY_PATH

# Wait for healthy services
timeout $WAIT_TIMEOUT sh -c 'until docker compose ps | grep -q "healthy"; do sleep 2; done' || true

# Check API health
if curl -f http://localhost:3000/health; then
  echo "✅ Health check passed"
else
  echo "❌ Health check failed"
  exit 1
fi
HEALTH_EOF

# Step 6: Smoke tests (production only)
if [[ "$ENVIRONMENT" == "production" ]]; then
  echo "🧪 Running smoke tests..."
  ssh -o StrictHostKeyChecking=yes \
    "${VPS_USER}@${VPS_HOST}" \
    "VPS_DEPLOY_PATH='${VPS_DEPLOY_PATH}'" \
    bash << 'SMOKE_EOF'
  set -euo pipefail
  cd $VPS_DEPLOY_PATH

  if curl -f http://localhost:3000/health && curl -f http://localhost:3000/api; then
    echo "✅ Smoke tests passed"
  else
    echo "❌ Smoke tests failed"
    exit 1
  fi
SMOKE_EOF
fi

echo "✅ $ENVIRONMENT deployment completed successfully!"
