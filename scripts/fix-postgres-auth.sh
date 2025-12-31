#!/bin/bash
# Fix PostgreSQL authentication issues for docker-compose.local.yml
# Run this script on the VPS where the containers are running

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== PostgreSQL Authentication Fix Script ===${NC}"

# Load .env if exists
if [ -f .env ]; then
    echo -e "${GREEN}Loading .env file...${NC}"
    set -a
    source .env
    set +a
fi

# Get credentials from env or use defaults
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-motiv_buy_dev}"
PROJECT_NAME="${PROJECT_NAME:-motiv-buy}"
ENV="${ENV:-dev}"

echo -e "Using credentials:"
echo -e "  User: ${DB_USER}"
echo -e "  Password: ${DB_PASSWORD}"
echo -e "  Database: ${DB_NAME}"

# Detect PostgreSQL container (local compose uses 'postgres', dev uses 'postgres-dev')
POSTGRES_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E "${PROJECT_NAME}.*postgres" | head -1)

if [ -z "$POSTGRES_CONTAINER" ]; then
    echo -e "${RED}Error: No PostgreSQL container found running${NC}"
    echo "Available containers:"
    docker ps --format '{{.Names}}'
    echo ""
    echo "Please start the PostgreSQL container first:"
    echo "  docker compose -f docker-compose.local.yml up -d postgres"
    exit 1
fi

echo -e "${GREEN}Found PostgreSQL container: ${POSTGRES_CONTAINER}${NC}"

# Method 1: Try to connect with current password
echo -e "\n${YELLOW}Testing current connection...${NC}"
if docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres -c "SELECT 1" 2>/dev/null; then
    echo -e "${GREEN}Connection successful with current password!${NC}"

    # Create database if it doesn't exist
    echo -e "\n${YELLOW}Checking database existence...${NC}"
    if ! docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
        echo -e "${YELLOW}Creating database: $DB_NAME${NC}"
        docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"
        echo -e "${GREEN}Database created successfully!${NC}"
    else
        echo -e "${GREEN}Database $DB_NAME already exists${NC}"
    fi
    exit 0
fi

echo -e "${YELLOW}Current password not working, attempting fix...${NC}"

# Method 2: Reset password via pg_hba.conf (trust auth temporarily)
echo -e "\n${YELLOW}Attempting to fix via pg_hba.conf...${NC}"

# Find pg_hba.conf location inside container
PG_HBA_PATH=$(docker exec "$POSTGRES_CONTAINER" bash -c "find /var/lib/postgresql -name 'pg_hba.conf' 2>/dev/null | head -1")

if [ -z "$PG_HBA_PATH" ]; then
    PG_HBA_PATH="/var/lib/postgresql/data/pg_hba.conf"
fi

echo -e "Using pg_hba.conf at: ${PG_HBA_PATH}"

# Backup pg_hba.conf
docker exec "$POSTGRES_CONTAINER" cp "$PG_HBA_PATH" "${PG_HBA_PATH}.bak"

# Set trust auth temporarily for all connections
docker exec "$POSTGRES_CONTAINER" bash -c "sed -i 's/md5/trust/g; s/scram-sha-256/trust/g' '$PG_HBA_PATH'"

# Reload PostgreSQL config
echo -e "${YELLOW}Reloading PostgreSQL configuration...${NC}"
docker exec "$POSTGRES_CONTAINER" bash -c "pg_ctl reload -D \$(dirname '$PG_HBA_PATH')" 2>/dev/null || \
docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres -c "SELECT pg_reload_conf();" 2>/dev/null || true

# Wait for reload
sleep 2

# Now change the password
echo -e "${YELLOW}Changing password for user: $DB_USER${NC}"
docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres -c "ALTER USER \"$DB_USER\" PASSWORD '$DB_PASSWORD';"

# Create database if needed
echo -e "${YELLOW}Ensuring database exists: $DB_NAME${NC}"
docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";" 2>/dev/null || echo "Database already exists or error"

# Restore original pg_hba.conf
docker exec "$POSTGRES_CONTAINER" cp "${PG_HBA_PATH}.bak" "$PG_HBA_PATH"

# Reload PostgreSQL config again
docker exec "$POSTGRES_CONTAINER" bash -c "pg_ctl reload -D \$(dirname '$PG_HBA_PATH')" 2>/dev/null || \
docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres -c "SELECT pg_reload_conf();" 2>/dev/null || true

echo -e "\n${GREEN}=== Fix Applied Successfully ===${NC}"
echo -e "Password updated to: $DB_PASSWORD"
echo -e "Database: $DB_NAME"
echo -e "\nTest connection with:"
echo -e "  docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -c 'SELECT version();'"
echo -e "\nOr restart the app services:"
echo -e "  docker compose -f docker-compose.local.yml restart api bot"
