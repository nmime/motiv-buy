#!/bin/bash
# Fix PostgreSQL authentication issues on VPS
# Run this script on the server where PostgreSQL 18 is running

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== PostgreSQL Authentication Fix Script ===${NC}"

# Get the password from .env or use default
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-motiv_buy_dev}"

echo -e "Using credentials:"
echo -e "  User: ${DB_USER}"
echo -e "  Password: ${DB_PASSWORD}"
echo -e "  Database: ${DB_NAME}"

# Detect PostgreSQL container
POSTGRES_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'postgres' | head -1)

if [ -z "$POSTGRES_CONTAINER" ]; then
    echo -e "${RED}Error: No PostgreSQL container found running${NC}"
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
        docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;"
        echo -e "${GREEN}Database created successfully!${NC}"
    else
        echo -e "${GREEN}Database $DB_NAME already exists${NC}"
    fi
    exit 0
fi

echo -e "${YELLOW}Current password not working, attempting fix...${NC}"

# Method 2: Reset password via pg_hba.conf (trust auth temporarily)
echo -e "\n${YELLOW}Attempting to fix via pg_hba.conf...${NC}"

# Backup pg_hba.conf
docker exec "$POSTGRES_CONTAINER" cp /var/lib/postgresql/data/pg_hba.conf /var/lib/postgresql/data/pg_hba.conf.bak

# Set trust auth temporarily for local connections
docker exec "$POSTGRES_CONTAINER" bash -c "sed -i 's/md5/trust/g; s/scram-sha-256/trust/g' /var/lib/postgresql/data/pg_hba.conf"

# Reload PostgreSQL config
docker exec "$POSTGRES_CONTAINER" bash -c "pg_ctl reload -D /var/lib/postgresql/data"

# Wait for reload
sleep 2

# Now change the password
echo -e "${YELLOW}Changing password for user: $DB_USER${NC}"
docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres -c "ALTER USER $DB_USER PASSWORD '$DB_PASSWORD';"

# Create database if needed
echo -e "${YELLOW}Ensuring database exists: $DB_NAME${NC}"
docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true

# Restore original pg_hba.conf
docker exec "$POSTGRES_CONTAINER" cp /var/lib/postgresql/data/pg_hba.conf.bak /var/lib/postgresql/data/pg_hba.conf

# Reload PostgreSQL config
docker exec "$POSTGRES_CONTAINER" bash -c "pg_ctl reload -D /var/lib/postgresql/data"

echo -e "\n${GREEN}=== Fix Applied Successfully ===${NC}"
echo -e "Password updated to: $DB_PASSWORD"
echo -e "Database created: $DB_NAME"
echo -e "\nTest connection with:"
echo -e "  docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -c 'SELECT version();'"
