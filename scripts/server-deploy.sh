#!/bin/bash
# Server deployment script for manual git pull workflow
# Usage: ./scripts/server-deploy.sh

set -e

cd /opt/motiv-buy

echo "==> Pulling latest code..."
git pull

echo "==> Building and starting containers..."
docker compose -f docker-compose.local.yml up -d --build

echo "==> Running migrations..."
docker compose -f docker-compose.local.yml exec -T api node dist/apps/migration/src/main.js || true

echo "==> Status:"
docker compose -f docker-compose.local.yml ps

echo "==> Done!"
