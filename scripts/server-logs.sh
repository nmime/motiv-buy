#!/bin/bash
# View server logs
# Usage: ./scripts/server-logs.sh [service]
# Examples:
#   ./scripts/server-logs.sh        # api + bot logs
#   ./scripts/server-logs.sh api    # api only
#   ./scripts/server-logs.sh bot    # bot only

cd /opt/motiv-buy
docker compose -f docker-compose.local.yml logs -f ${1:-api bot}
