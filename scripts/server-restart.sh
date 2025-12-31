#!/bin/bash
# Restart server services
# Usage: ./scripts/server-restart.sh [service]
# Examples:
#   ./scripts/server-restart.sh        # restart api + bot
#   ./scripts/server-restart.sh api    # restart api only

cd /opt/motiv-buy
docker compose -f docker-compose.local.yml restart ${1:-api bot}
echo "==> Restarted!"
