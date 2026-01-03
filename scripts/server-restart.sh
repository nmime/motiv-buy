#!/bin/bash
# Restart server services
# Usage: ./scripts/server-restart.sh [service]
# Examples:
#   ./scripts/server-restart.sh           # restart api + bot
#   ./scripts/server-restart.sh api       # restart api only
#   ./scripts/server-restart.sh postgres  # restart postgres

cd /opt/motiv-buy

SERVICE=${1:-}

if [ -z "$SERVICE" ]; then
  docker compose -f docker-compose.local.yml restart api bot
  echo "==> Restarted api and bot!"
elif [ "$SERVICE" = "postgres" ] || [ "$SERVICE" = "redis" ] || [ "$SERVICE" = "nats" ]; then
  docker compose -f docker-compose.infra.yml restart $SERVICE
  echo "==> Restarted $SERVICE!"
else
  docker compose -f docker-compose.local.yml restart $SERVICE
  echo "==> Restarted $SERVICE!"
fi
