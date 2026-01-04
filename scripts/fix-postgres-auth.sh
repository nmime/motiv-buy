#!/bin/bash
# Fix PostgreSQL authentication issues
# Usage: ./scripts/fix-postgres-auth.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Load .env if exists
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_USER="${DB_USER:-postgres}"

# Detect PostgreSQL container
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E "motiv-postgres|postgres" | head -1)

if [ -z "$CONTAINER" ]; then
    echo -e "${RED}Error: No PostgreSQL container found${NC}"
    docker ps --format '{{.Names}}'
    exit 1
fi

echo -e "${GREEN}Found container: $CONTAINER${NC}"
echo "Resetting password for user: $DB_USER"

docker exec -u postgres "$CONTAINER" sh -c '
  PG_HBA=$(find /var/lib/postgresql -name pg_hba.conf 2>/dev/null | head -1)
  PG_DATA=$(dirname "$PG_HBA")

  echo "Using: $PG_HBA"

  # Temporarily allow trust
  sed -i "s/scram-sha-256/trust/g; s/md5/trust/g" "$PG_HBA"
  pg_ctl reload -D "$PG_DATA"
  sleep 1

  # Reset password
  psql -c "ALTER USER '"$DB_USER"' WITH PASSWORD '"'"''"$DB_PASSWORD"''"'"';"

  # Restore scram-sha-256
  sed -i "s/trust/scram-sha-256/g" "$PG_HBA"
  pg_ctl reload -D "$PG_DATA"
'

echo -e "${GREEN}Password reset done!${NC}"
