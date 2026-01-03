#!/bin/bash
# Server deployment script for manual git pull workflow
# Usage: ./scripts/server-deploy.sh

set -e

cd /opt/motiv-buy

echo "==> Pulling latest code..."
git pull

echo "==> Starting infrastructure..."
docker compose -f docker-compose.infra.yml up -d

echo "==> Building and starting apps..."
docker compose -f docker-compose.local.yml up -d --build

echo "==> Running migrations..."
sleep 3
docker compose -f docker-compose.local.yml exec -T api node dist/apps/migration/src/main.js up || true

echo "==> Status:"
docker compose -f docker-compose.infra.yml ps
docker compose -f docker-compose.local.yml ps

echo "==> Done!"
