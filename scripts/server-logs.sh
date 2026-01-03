#!/bin/bash
# View server logs
# Usage: ./scripts/server-logs.sh [service]
# Examples:
#   ./scripts/server-logs.sh           # api + bot logs
#   ./scripts/server-logs.sh api       # api only
#   ./scripts/server-logs.sh postgres  # postgres logs

cd /opt/motiv-buy

SERVICE=${1:-}

if [ -z "$SERVICE" ]; then
  docker compose -f docker-compose.local.yml logs -f api bot
elif [ "$SERVICE" = "postgres" ] || [ "$SERVICE" = "redis" ] || [ "$SERVICE" = "nats" ]; then
  docker compose -f docker-compose.infra.yml logs -f $SERVICE
else
  docker compose -f docker-compose.local.yml logs -f $SERVICE
fi
