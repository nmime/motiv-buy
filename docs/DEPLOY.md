# Deployment Guide

Deploy Motiv-Buy to staging and production environments.

---

## Quick Start Checklist

- [ ] VPS servers ready (Ubuntu 22.04+)
- [ ] Domain configured (DNS propagated)
- [ ] GitHub repository access
- [ ] SSH keys generated
- [ ] GitHub secrets configured
- [ ] First deployment: Deploy → Migrate
- [ ] Updates: Migrate → Deploy

---

## 1. Server Setup (One-Time)

### DNS Configuration

**Staging (157.180.64.229):**

```
A    st            → 157.180.64.229
A    api.st        → 157.180.64.229
A    bot.st        → 157.180.64.229
```

**Production (65.108.218.78):**

```
A    @             → 65.108.218.78
A    api           → 65.108.218.78
A    bot           → 65.108.218.78
```

Verify: `dig st.motivbuy.com +short`

### Run Setup Script

```bash
# Copy and execute setup script
scp scripts/setup-server.sh root@<SERVER_IP>:/root/
ssh root@<SERVER_IP> "bash /root/setup-server.sh <environment>"

# Examples:
ssh root@157.180.64.229 "bash /root/setup-server.sh staging"
ssh root@65.108.218.78 "bash /root/setup-server.sh production"
```

### Configure SSH Keys

```bash
# Generate deployment keys
ssh-keygen -t ed25519 -C "deploy-staging" -f ~/.ssh/motiv-staging
ssh-keygen -t ed25519 -C "deploy-production" -f ~/.ssh/motiv-production

# Add to servers
cat ~/.ssh/motiv-staging.pub | ssh deployer@157.180.64.229 'tee -a ~/.ssh/authorized_keys'
cat ~/.ssh/motiv-production.pub | ssh deployer@65.108.218.78 'tee -a ~/.ssh/authorized_keys'

# Test access
ssh -i ~/.ssh/motiv-staging deployer@157.180.64.229
ssh -i ~/.ssh/motiv-production deployer@65.108.218.78
```

---

## 2. Generate Secrets

```bash
# Generate secure secrets
openssl rand -base64 32  # DB_PASSWORD
openssl rand -base64 32  # REDIS_PASSWORD
openssl rand -base64 64  # JWT_SECRET

# Generate NATS password (plaintext - bcrypt hash will be auto-generated during deployment)
openssl rand -base64 32  # NATS_PASSWORD
```

**Note:** The bcrypt hash for NATS will be automatically generated from `NATS_PASSWORD` during deployment. You only need to store the plaintext password in GitHub secrets.

**Telegram Bot Tokens:**

- Open @BotFather in Telegram
- Create separate bots for staging and production
- Save tokens for GitHub secrets

---

## 3. GitHub Configuration

### Repository Secrets (Settings → Secrets → Actions)

Add these secrets:

```
VPS_SSH_KEY              # Private key content (cat ~/.ssh/motiv-staging)
DB_PASSWORD              # From step 2
REDIS_PASSWORD           # From step 2
JWT_SECRET               # From step 2
NATS_USER                # NATS username (e.g., nats_user)
NATS_PASSWORD            # NATS plaintext password (from step 2, bcrypt hash auto-generated)
TELEGRAM_BOT_TOKEN       # From @BotFather
CRYPTO_BOT_API_TOKEN     # From @CryptoBot
LETSENCRYPT_EMAIL        # Your email for SSL
DB_NAME                  # Database name (e.g., motivbuy)
DB_USER                  # Database user (e.g., motiv_user)
DB_HOST                  # postgres-prod (default)
```

### Environment Variables (Settings → Environments)

**Create `staging` environment:**

```
VPS_HOST                 # 157.180.64.229
VPS_USER                 # deployer
VPS_DEPLOY_PATH          # /opt/motiv-buy/staging
```

**Create `production` environment:**

```
VPS_HOST                 # 65.108.218.78
VPS_USER                 # deployer
VPS_DEPLOY_PATH          # /opt/motiv-buy/production
```

---

## 4. Deployment

### First-Time Deployment (Fresh Server)

**Order: Deploy FIRST → Migrate SECOND**

```bash
# Step 1: Deploy (creates infrastructure: PostgreSQL, Redis, NATS)
GitHub → Actions → Deploy → Run workflow
  Environment: staging (or production)
  Branch: master

# Step 2: Migrate (creates database tables)
GitHub → Actions → Run Database Migrations → Run workflow
  Environment: staging (or production)
  Action: up
```

### Subsequent Deployments (Updates)

**Order: Migrate FIRST → Deploy SECOND**

```bash
# Step 1: Migrate (update database schema)
GitHub → Actions → Run Database Migrations → Run workflow
  Environment: staging (or production)
  Action: up

# Step 2: Deploy (update application code)
GitHub → Actions → Deploy → Run workflow
  Environment: staging (or production)
  Branch: master
```

---

## 5. Verification

### Check Deployment Status

```bash
# View containers
ssh deployer@<SERVER_IP> "cd /opt/motiv-buy/<environment> && docker compose ps"

# View logs
ssh deployer@<SERVER_IP> "cd /opt/motiv-buy/<environment> && docker compose logs -f api"
ssh deployer@<SERVER_IP> "cd /opt/motiv-buy/<environment> && docker compose logs -f bot"

# Check health
curl https://api.st.motivbuy.com/health        # Staging
curl https://api.motivbuy.com/health            # Production
```

### Migration Status

```bash
# Check migration status
GitHub → Actions → Run Database Migrations → Run workflow
  Environment: staging (or production)
  Action: status
```

---

## Quick Reference

### Deployment URLs

| Environment | API                         | Bot                         | Status    |
| ----------- | --------------------------- | --------------------------- | --------- |
| Staging     | https://api.st.motivbuy.com | https://bot.st.motivbuy.com | `/health` |
| Production  | https://api.motivbuy.com    | https://bot.motivbuy.com    | `/health` |

### SSH Access

```bash
# Staging
ssh deployer@157.180.64.229
cd /opt/motiv-buy/staging
docker compose ps

# Production
ssh deployer@65.108.218.78
cd /opt/motiv-buy/production
docker compose ps
```

### Common Commands

```bash
# View logs
docker compose logs -f <service>

# Restart service
docker compose restart <service>

# Check status
docker compose ps

# Execute command in container
docker compose exec <service> <command>
```

---

## Troubleshooting

### Deployment Failed

```bash
# Check workflow logs in GitHub Actions
# SSH to server and check container status
ssh deployer@<SERVER_IP>
cd /opt/motiv-buy/<environment>
docker compose ps
docker compose logs <service>
```

### Migration Failed

```bash
# Check migration status
GitHub Actions → Run Database Migrations → Action: status

# Rollback last migration
GitHub Actions → Run Database Migrations → Action: down

# Production: Restore from backup
ssh deployer@65.108.218.78
cd /opt/motiv-buy/production/backups
ls -lah  # Find latest backup
# Contact admin for restore procedure
```

### Health Check Failed

```bash
# Check service logs
ssh deployer@<SERVER_IP>
cd /opt/motiv-buy/<environment>
docker compose logs api
docker compose logs bot

# Restart services
docker compose restart api bot

# Check database connection
docker compose exec api node -e "require('./dist/apps/api/main').bootstrap()"
```

### SSL Certificate Issues

```bash
# Certificate auto-renews via Let's Encrypt
# If renewal fails, check nginx logs
docker compose logs nginx

# Manual renewal
docker compose exec nginx certbot renew --dry-run
```

---

## Appendix: How It Works

### Infrastructure Services

The deployment automatically manages these services via Docker Compose:

- **PostgreSQL 18**: Database (data mounted to `${VPS_DEPLOY_PATH}/data/postgres`)
- **Redis 7**: Cache and sessions (data mounted to `${VPS_DEPLOY_PATH}/data/redis`)
- **NATS JetStream**: Message queue (data mounted to `${VPS_DEPLOY_PATH}/data/nats`)
- **Nginx**: Reverse proxy with SSL/TLS

All data is persisted to server directories under `/opt/motiv-buy/<environment>/data/`.

### Zero-Downtime Deployments

Deployments use rolling updates:

- Health checks ensure services are ready before switching traffic
- Infrastructure services (PostgreSQL, Redis, NATS) remain running
- Only application services (API, Bot) are updated
- `--wait` flags ensure new containers are healthy before completing

### Deployment Order Explained

**First-Time (Fresh Server):**

```
1. Deploy → Creates infrastructure (PostgreSQL, Redis, NATS)
2. Migrate → Creates tables in newly created database
```

**Subsequent (Updates):**

```
1. Migrate → Updates database schema for new code
2. Deploy → Updates application code (uses updated schema)
```

### CI/CD Pipeline

**On Push/PR:**

1. Quality checks (lint, format, tests) - non-blocking
2. Docker build (all apps) - blocking
3. Security scan - non-blocking

**On Manual Deploy:**

1. Validate environment and branch
2. Build and push Docker images
3. Deploy to target environment
4. Run health checks

**Manual Migrations:**

1. Build migration image
2. Run migration in environment
3. Display status

For detailed CI/CD workflow execution, see GitHub Actions workflow files in `.github/workflows/`.

---

## Environment Variables

All environment variables are automatically created during deployment:

**Common:**

- `NODE_ENV`: staging or production
- `VPS_DEPLOY_PATH`: Deployment directory on server
- `DOCKER_REGISTRY`: ghcr.io
- `DOCKER_IMAGE_PREFIX`: GitHub org/repo prefix
- `IMAGE_TAG`: staging or latest

**Database:**

- `DB_HOST`: postgres-prod (container name)
- `DB_PORT`: 5432
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password

**Redis:**

- `REDIS_HOST`: redis-prod (container name)
- `REDIS_PORT`: 6379
- `REDIS_PASSWORD`: Redis password

**NATS:**

- `NATS_URL`: nats://nats-prod:4222 (container URL)
- `NATS_USER`: NATS username
- `NATS_PASSWORD`: NATS plaintext password (bcrypt hash auto-generated during deployment)

**Application:**

- `JWT_SECRET`: JWT signing secret
- `JWT_EXPIRES_IN`: Token expiration (7d)
- `TELEGRAM_BOT_TOKEN`: Bot token from @BotFather
- `CRYPTO_BOT_API_TOKEN`: Payment provider token
- `LOG_LEVEL`: debug (staging), warn (production)

**Domains (auto-configured):**

- Staging: `api.st.motivbuy.com`, `bot.st.motivbuy.com`
- Production: `api.motivbuy.com`, `bot.motivbuy.com`

---

**Need Help?** Check workflow logs in GitHub Actions or SSH to server for container logs.
