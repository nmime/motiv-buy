#!/bin/sh
set -e

# Custom entrypoint that ensures password is synced with environment variable
# This solves the issue where existing PostgreSQL data has a different password

# Find the actual data directory (varies by PG version)
PG_DATA=$(find /var/lib/postgresql -name "pg_hba.conf" -exec dirname {} \; 2>/dev/null | head -1)
if [ -z "$PG_DATA" ]; then
    PG_DATA="/var/lib/postgresql/data"
fi
PG_HBA="$PG_DATA/pg_hba.conf"

# If data directory exists (not first run), temporarily allow trust auth
if [ -f "$PG_HBA" ]; then
    # Backup and modify pg_hba.conf to trust local connections
    cp "$PG_HBA" "$PG_HBA.bak"
    sed -i 's/md5/trust/g' "$PG_HBA"
    sed -i 's/scram-sha-256/trust/g' "$PG_HBA"

    # Start password reset in background after postgres is ready
    {
        # Wait for postgres to be ready
        while ! pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q 2>/dev/null; do
            sleep 1
        done

        # Reset password to match environment variable
        psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';" 2>/dev/null || true

        echo "Password synchronized with environment variable"

        # Restore original pg_hba.conf
        cp "$PG_HBA.bak" "$PG_HBA"
        rm -f "$PG_HBA.bak"

        # Reload postgres config
        pg_ctl reload -D "$PG_DATA" 2>/dev/null || true
    } &
fi

# Run original postgres entrypoint
exec docker-entrypoint.sh "$@"
