#!/bin/bash
# Backup PostgreSQL database
# Usage: ./scripts/server-backup-db.sh

set -e

cd /opt/motiv-buy
source .env

BACKUP_DIR="/opt/motiv-buy/data/backups"
FILE="$BACKUP_DIR/db_$(date +%Y%m%d_%H%M%S).sql.gz"

mkdir -p $BACKUP_DIR

echo "==> Creating backup..."
docker exec motiv-postgres pg_dump -U $DB_USER $DB_NAME | gzip > $FILE

echo "==> Backup created: $FILE"

# Keep last 7 backups
ls -t $BACKUP_DIR/db_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm

echo "==> Done!"
