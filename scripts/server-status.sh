#!/bin/bash
# Check server status
# Usage: ./scripts/server-status.sh

cd /opt/motiv-buy

echo "==> Container Status:"
docker compose -f docker-compose.local.yml ps

echo ""
echo "==> Disk Usage:"
df -h /opt/motiv-buy

echo ""
echo "==> Docker Disk:"
docker system df
