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
set -eo pipefail

echo "=========================================="
echo "🔧 DEPLOYMENT START - v00e6fc2"
echo "=========================================="

# Change to deployment directory
if ! cd "$VPS_DEPLOY_PATH"; then
  echo "❌ FATAL: Failed to cd to ${VPS_DEPLOY_PATH}"
  echo "Directory does not exist or no permission"
  exit 1
fi

echo "✅ Working directory: $(pwd)"

# Validate ENV is set
if [ -z "${ENV}" ]; then
  echo "❌ FATAL: ENV variable is not set"
  exit 1
fi

echo "✅ Environment: ${ENV}"

# Source .env file for variables
if [ -f .env ]; then
  echo "📋 Loading environment variables from .env..."
  set -a
  source .env
  set +a
  echo "✅ Environment variables loaded"
else
  echo "⚠️  Warning: .env file not found"
fi

# Create data directories if they don't exist
mkdir -p data/postgres data/redis data/nats \
         data/nginx/logs \
         data/api/logs data/api/uploads data/api/temp \
         data/bot/logs data/bot/temp data/bot/sessions \
         data/prometheus data/grafana

# Login to Docker registry
echo "$GITHUB_TOKEN" | docker login $DOCKER_REGISTRY -u $GITHUB_ACTOR --password-stdin
LOGIN_EXIT=$?
if [ $LOGIN_EXIT -ne 0 ]; then
  echo "❌ Docker login failed with exit code: $LOGIN_EXIT"
  exit 1
fi
echo "✅ Docker login successful"

# Pull latest images
echo "📥 Pulling latest Docker images..."
echo "  This may take 1-2 minutes depending on image sizes..."

# Use timeout to prevent hanging (5 minutes should be enough)
if timeout 300 docker compose pull; then
  echo "✅ All images pulled successfully"
else
  TIMEOUT_EXIT=$?
  if [ $TIMEOUT_EXIT -eq 124 ]; then
    echo "❌ Docker pull timed out after 5 minutes"
  else
    echo "❌ Docker pull failed with exit code: $TIMEOUT_EXIT"
  fi
  exit 1
fi

# Maximum reliability deployment strategy:
# 1. Ensure base infrastructure is healthy (postgres, redis)
# 2. Update NATS with new config (brief restart, clients reconnect)
# 3. Deploy applications (they wait for dependencies via depends_on)
# 4. Update monitoring and gateway
# 5. Comprehensive health verification

echo ""
echo "======================================"
echo "🚀 Starting Deployment"
echo "======================================"

# Step 1: Update and verify base data services
echo ""
echo "📦 Step 1/5: Updating base data services..."
docker compose up -d postgres redis

echo "⏳ Waiting for postgres to be healthy..."
POSTGRES_HEALTHY=false
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "✅ PostgreSQL is healthy"
    POSTGRES_HEALTHY=true
    break
  fi
  echo "  Waiting... ($i/30)"
  sleep 2
done

if [ "$POSTGRES_HEALTHY" != "true" ]; then
  echo "❌ PostgreSQL failed to become healthy after 60 seconds"
  docker compose logs --tail=50 postgres
  exit 1
fi

echo "⏳ Waiting for redis to be healthy..."
REDIS_HEALTHY=false
for i in {1..30}; do
  # Use docker inspect to check health status (avoids format string issues in heredoc)
  if docker inspect "motiv-buy-redis-${ENV}" >/dev/null 2>&1; then
    REDIS_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "motiv-buy-redis-${ENV}" 2>/dev/null || echo "unknown")
    if [ "$REDIS_STATUS" = "healthy" ]; then
      echo "✅ Redis is healthy"
      REDIS_HEALTHY=true
      break
    fi
    echo "  Waiting... ($i/30) [status: $REDIS_STATUS]"
  else
    echo "  Waiting... ($i/30) [container not found yet]"
  fi
  sleep 2
done

if [ "$REDIS_HEALTHY" != "true" ]; then
  echo "❌ Redis failed to become healthy after 60 seconds"
  docker compose logs --tail=50 redis
  exit 1
fi

# Step 2: Update NATS with new configuration
echo ""
echo "🔄 Step 2/5: Updating NATS messaging service..."
echo "  Note: NATS will restart (~2 sec), clients auto-reconnect"

# Stop API/Bot before NATS restart to prevent connection errors
echo "  Stopping API/Bot temporarily..."
docker compose stop api bot || true

# Force recreate NATS to load new config
docker compose up -d --force-recreate --no-deps nats

echo "⏳ Waiting for NATS to be healthy..."
NATS_HEALTHY=false
for i in {1..20}; do
  # Use docker inspect to check health status
  if docker inspect "motiv-buy-nats-${ENV}" >/dev/null 2>&1; then
    NATS_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "motiv-buy-nats-${ENV}" 2>/dev/null || echo "unknown")
    if [ "$NATS_STATUS" = "healthy" ]; then
      echo "✅ NATS is healthy"
      NATS_HEALTHY=true
      break
    fi
    echo "  Waiting... ($i/20) [status: $NATS_STATUS]"
  else
    echo "  Waiting... ($i/20) [container not found yet]"
  fi
  sleep 2
done

if [ "$NATS_HEALTHY" != "true" ]; then
  echo "❌ NATS failed to become healthy after 40 seconds"
  echo "NATS logs:"
  docker compose logs --tail=100 nats
  exit 1
fi

# Step 3: Deploy application services
echo ""
echo "🚀 Step 3/5: Deploying application services..."
echo "  Force-recreating API and Bot with latest images..."

# Use --wait to ensure containers reach healthy state
# Remove --no-deps so depends_on health checks are respected
docker compose up -d --force-recreate --wait api bot

echo "⏳ Verifying API is healthy..."
API_HEALTHY=false
for i in {1..30}; do
  # Check if API health endpoint responds (PORT=3000 from .env)
  if docker compose exec -T api curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ API is healthy"
    API_HEALTHY=true
    break
  fi
  echo "  Waiting... ($i/30)"
  sleep 2
done

if [ "$API_HEALTHY" != "true" ]; then
  echo "❌ API failed to become healthy after 60 seconds"
  echo ""
  echo "API logs (last 100 lines):"
  docker compose logs --tail=100 api
  echo ""
  echo "Container status:"
  docker compose ps api
  echo ""
  echo "Checking if API container is even running..."
  if docker compose ps api | grep -q "Up"; then
    echo "Container is Up - checking internal health..."
    docker compose exec -T api wget -O- http://localhost:3000/health 2>&1 || echo "Health endpoint not responding"
  else
    echo "Container is not running!"
  fi
  exit 1
fi

echo "⏳ Verifying Bot is running..."
BOT_HEALTHY=false
for i in {1..10}; do
  if docker compose ps bot | grep -q "Up"; then
    echo "✅ Bot is running"
    BOT_HEALTHY=true
    break
  fi
  echo "  Waiting... ($i/10)"
  sleep 2
done

if [ "$BOT_HEALTHY" != "true" ]; then
  echo "❌ Bot failed to start"
  echo ""
  echo "Bot logs (last 100 lines):"
  docker compose logs --tail=100 bot
  echo ""
  echo "Container status:"
  docker compose ps bot
  exit 1
fi

# Step 4: Update monitoring and gateway
echo ""
echo "📊 Step 4/5: Updating monitoring and gateway..."

# Update monitoring services
echo "  Updating prometheus and grafana..."
docker compose up -d --force-recreate --no-deps prometheus grafana || echo "⚠️  Monitoring services optional"

# Update nginx with graceful reload
echo "  Updating nginx..."
if docker compose ps nginx 2>/dev/null | grep -q "Up"; then
  echo "  Gracefully reloading nginx (zero-downtime)..."
  docker compose exec -T nginx nginx -s reload 2>/dev/null || docker compose up -d nginx
else
  echo "  Starting nginx..."
  docker compose up -d nginx
fi

# Step 5: Final verification
echo ""
echo "🏥 Step 5/5: Final health verification..."
docker compose ps

# Ensure all critical services are running
echo "  Verifying critical services..."
if docker compose ps api | grep -q "Up.*healthy"; then
  echo "✅ API: Running and healthy"
else
  echo "❌ API: Not healthy"
  docker compose logs --tail=50 api
  exit 1
fi

if docker compose ps bot | grep -q "Up"; then
  echo "✅ Bot: Running"
else
  echo "❌ Bot: Not running"
  docker compose logs --tail=50 bot
  exit 1
fi

if docker compose ps postgres | grep -q "Up.*healthy"; then
  echo "✅ PostgreSQL: Healthy"
else
  echo "❌ PostgreSQL: Not healthy"
  exit 1
fi

echo ""
echo "======================================"
echo "✅ Deployment Completed Successfully"
echo "======================================"

# Cleanup old images
if [[ "$ENV" == "production" ]]; then
  docker image prune -af --filter 'until=48h'
else
  docker image prune -af --filter 'until=24h'
fi
DEPLOY_EOF

# Step 5: External health verification
echo "🏥 Running external health verification..."
ssh -o StrictHostKeyChecking=yes \
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
