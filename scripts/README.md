# Scripts

## Deployment

### Local Development
```bash
# Start infrastructure
docker compose -f docker-compose.infra.yml up -d

# Run apps natively
pnpm run dev:api
pnpm run dev:bot
```

### VPS Manual Deploy (git pull)
```bash
./scripts/server-deploy.sh
```

### Production (CI/CD)
Uses `docker-compose.production.yml` with registry images.
Triggered via GitHub Actions.

## Server Management

```bash
./scripts/server-status.sh           # Check status
./scripts/server-logs.sh [service]   # View logs (api, bot, postgres, redis, nats)
./scripts/server-restart.sh [service] # Restart services
./scripts/server-backup-db.sh        # Backup database
```

## Utilities

| Script | Purpose |
|--------|---------|
| `postgres-entrypoint.sh` | Auto-sync PostgreSQL password on container start |
| `fix-postgres-auth.sh` | Manual PostgreSQL password fix |
| `generate-nats-password.sh` | Generate bcrypt hash for NATS auth |
| `prepare-nats-config.sh` | Prepare NATS config with env substitution |
| `setup-server.sh` | Initial VPS setup |
| `deploy-remote.sh` | CI/CD remote deployment script |

## Docker Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.infra.yml` | Infrastructure (postgres, redis, nats) |
| `docker-compose.local.yml` | Apps with local build (api, bot) |
| `docker-compose.production.yml` | Apps with registry images |
