#!/usr/bin/env bash
# Remote deployment script - executed on VPS
# Environment variables are passed from the main deploy.sh script
# Required: ENV, VPS_DEPLOY_PATH, REDIS_PASSWORD

set -euo pipefail

echo "=========================================="
echo "🔧 DEPLOYMENT START - v$(date +%Y%m%d-%H%M%S)"
echo "DEBUG: Script execution environment:"
echo "  - Bash version: $BASH_VERSION"
echo "  - Working directory: $(pwd)"
echo "  - ENV variable: ${ENV}"
echo "  - Shell options: $-"
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

# Pull images (with timeout if available)
if command -v timeout >/dev/null 2>&1; then
  echo "  Using 5-minute timeout..."
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
else
  echo "  No timeout available, pulling without timeout..."
  if docker compose pull; then
    echo "✅ All images pulled successfully"
  else
    echo "❌ Docker pull failed with exit code: $?"
    exit 1
  fi
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
docker compose up -d postgres redis || { echo "❌ Failed to start postgres/redis"; exit 1; }
echo "DEBUG: Postgres/Redis containers started"

echo "⏳ Waiting for postgres to be healthy..."
POSTGRES_ATTEMPTS=0
set +e  # Disable exit on error for health check
until docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; do
  POSTGRES_ATTEMPTS=$((POSTGRES_ATTEMPTS + 1))
  if [ $POSTGRES_ATTEMPTS -ge 30 ]; then
    set -e  # Re-enable before exit
    echo "❌ PostgreSQL timeout after $POSTGRES_ATTEMPTS attempts"
    docker compose logs --tail=50 postgres
    exit 1
  fi
  echo "  Waiting... ($POSTGRES_ATTEMPTS/30)"
  sleep 2
done
set -e  # Re-enable exit on error
echo "✅ PostgreSQL is healthy (attempts: $POSTGRES_ATTEMPTS)"
echo "DEBUG: PostgreSQL health verified, continuing..."

echo "⏳ Waiting for redis to be healthy..."
REDIS_ATTEMPTS=0
set +e  # Disable exit on error for health check
until docker compose exec -T redis redis-cli -a "$REDIS_PASSWORD" ping >/dev/null 2>&1; do
  REDIS_ATTEMPTS=$((REDIS_ATTEMPTS + 1))
  if [ $REDIS_ATTEMPTS -ge 30 ]; then
    set -e  # Re-enable before exit
    echo "❌ Redis timeout after $REDIS_ATTEMPTS attempts"
    docker compose logs --tail=50 redis
    exit 1
  fi
  echo "  Waiting... ($REDIS_ATTEMPTS/30)"
  sleep 2
done
set -e  # Re-enable exit on error
echo "✅ Redis is healthy (attempts: $REDIS_ATTEMPTS)"
echo "DEBUG: Redis health verified, continuing to Step 2..."

# Step 2: Update NATS with new configuration
echo ""
echo "🔄 Step 2/5: Updating NATS messaging service..."
echo "DEBUG: Starting Step 2..."
echo "  Stopping API/Bot temporarily..."
docker compose stop api bot || true
echo "DEBUG: API/Bot stopped (if they were running)"

docker compose up -d --force-recreate --no-deps nats || { echo "❌ Failed to start NATS"; exit 1; }
echo "DEBUG: NATS container started, checking health..."

echo "⏳ Waiting for NATS to be healthy..."
NATS_ATTEMPTS=0
set +e  # Disable exit on error for health check
until [ "$(docker inspect --format='{{.State.Health.Status}}' "motiv-buy-nats-${ENV}" 2>/dev/null || echo "unknown")" = "healthy" ]; do
  NATS_ATTEMPTS=$((NATS_ATTEMPTS + 1))
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "motiv-buy-nats-${ENV}" 2>/dev/null || echo "unknown")
  if [ $NATS_ATTEMPTS -ge 20 ]; then
    set -e  # Re-enable before exit
    echo "❌ NATS timeout after $NATS_ATTEMPTS attempts (status: $STATUS)"
    docker compose logs --tail=100 nats
    exit 1
  fi
  echo "  Waiting... ($NATS_ATTEMPTS/20) [status: $STATUS]"
  sleep 2
done
set -e  # Re-enable exit on error
echo "✅ NATS is healthy (attempts: $NATS_ATTEMPTS)"
echo "DEBUG: NATS health verified, continuing to Step 3..."

# Step 3: Deploy application services
echo ""
echo "🚀 Step 3/5: Deploying application services..."
echo "DEBUG: Starting Step 3..."
docker compose up -d --force-recreate --wait api bot || { echo "❌ Failed to start API/Bot"; exit 1; }
echo "DEBUG: API/Bot containers started, checking health..."

echo "⏳ Verifying API is healthy..."
API_ATTEMPTS=0
set +e  # Disable exit on error for health check
until docker compose exec -T api curl -sf http://localhost:3000/health >/dev/null 2>&1; do
  API_ATTEMPTS=$((API_ATTEMPTS + 1))
  if [ $API_ATTEMPTS -ge 30 ]; then
    set -e  # Re-enable before exit
    echo "❌ API timeout after $API_ATTEMPTS attempts"
    docker compose logs --tail=100 api
    docker compose ps api
    exit 1
  fi
  echo "  Waiting... ($API_ATTEMPTS/30)"
  sleep 2
done
set -e  # Re-enable exit on error
echo "✅ API is healthy (attempts: $API_ATTEMPTS)"
echo "DEBUG: API health verified"

echo "⏳ Verifying Bot is running..."
BOT_ATTEMPTS=0
set +e  # Disable exit on error for health check
until docker compose ps bot | grep -q "Up"; do
  BOT_ATTEMPTS=$((BOT_ATTEMPTS + 1))
  if [ $BOT_ATTEMPTS -ge 10 ]; then
    set -e  # Re-enable before exit
    echo "❌ Bot timeout after $BOT_ATTEMPTS attempts"
    docker compose logs --tail=100 bot
    docker compose ps bot
    exit 1
  fi
  echo "  Waiting... ($BOT_ATTEMPTS/10)"
  sleep 2
done
set -e  # Re-enable exit on error
echo "✅ Bot is running (attempts: $BOT_ATTEMPTS)"
echo "DEBUG: Bot verified, continuing to Step 4..."

# Step 4: Update monitoring and gateway
echo ""
echo "📊 Step 4/5: Updating monitoring and gateway..."
echo "DEBUG: Starting Step 4..."

# Update monitoring services
echo "  Updating prometheus and grafana..."
docker compose up -d --force-recreate --no-deps prometheus grafana || echo "⚠️  Monitoring services optional"
echo "DEBUG: Monitoring services updated"

# Update nginx with graceful reload
echo "  Updating nginx..."
if docker compose ps nginx 2>/dev/null | grep -q "Up"; then
  echo "  Gracefully reloading nginx (zero-downtime)..."
  docker compose exec -T nginx nginx -s reload 2>/dev/null || docker compose up -d nginx
else
  echo "  Starting nginx..."
  docker compose up -d nginx
fi
echo "DEBUG: Nginx updated, continuing to Step 5..."

# Step 5: Final verification
echo ""
echo "🏥 Step 5/5: Final health verification..."
echo "DEBUG: Starting Step 5..."
docker compose ps
echo "DEBUG: Container status listed"

# Ensure all critical services are running
echo "  Verifying critical services..."
if docker compose ps api | grep -q "Up.*healthy"; then
  echo "✅ API: Running and healthy"
else
  echo "❌ API: Not healthy"
  docker compose logs --tail=50 api
  exit 1
fi
echo "DEBUG: API verified"

if docker compose ps bot | grep -q "Up"; then
  echo "✅ Bot: Running"
else
  echo "❌ Bot: Not running"
  docker compose logs --tail=50 bot
  exit 1
fi
echo "DEBUG: Bot verified"

if docker compose ps postgres | grep -q "Up.*healthy"; then
  echo "✅ PostgreSQL: Healthy"
else
  echo "❌ PostgreSQL: Not healthy"
  exit 1
fi
echo "DEBUG: PostgreSQL verified"

echo ""
echo "======================================"
echo "✅ Deployment Completed Successfully"
echo "======================================"
echo "DEBUG: All steps completed successfully!"

# Cleanup old images
if [[ "$ENV" == "production" ]]; then
  docker image prune -af --filter 'until=48h'
else
  docker image prune -af --filter 'until=24h'
fi
