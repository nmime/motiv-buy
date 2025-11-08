# Deployment Guide

Complete guide for deploying Motiv-Buy application using Docker and GitHub Actions CI/CD.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Local Development](#local-development)
4. [VPS Setup](#vps-setup)
5. [GitHub Secrets Configuration](#github-secrets-configuration)
6. [Deployment Process](#deployment-process)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)
9. [Rollback Procedures](#rollback-procedures)

---

## Architecture Overview

### Deployment Strategy

- **CI Pipeline**: Runs on all branches (lint, test, build, security scan)
- **Staging Deployment**: Auto-deploys all branches except `main`
- **Production Deployment**: Auto-deploys on push to `main` or version tags

### Infrastructure

```
VPS Server
├── Nginx (Reverse Proxy)
│   ├── SSL/TLS (Let's Encrypt)
│   ├── Rate Limiting
│   └── Security Headers
├── Docker Containers
│   ├── API Application
│   ├── Bot Application
│   ├── PostgreSQL Database
│   └── Redis Cache
└── Automated Backups
```

---

## Prerequisites

### Local Development

- Docker Engine 24.0+
- Docker Compose 2.20+
- Node.js 20+ (for local development without Docker)
- pnpm 8+

### VPS Requirements

- Ubuntu 22.04 LTS (recommended)
- Minimum 2 CPU cores
- Minimum 4GB RAM
- 20GB+ storage
- Root or sudo access
- Public IP address
- Domain name (for production)

---

## Local Development

### 1. Clone Repository

```bash
git clone https://github.com/your-username/motiv-buy.git
cd motiv-buy
```

### 2. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your local values
nano .env
```

### 3. Start Services

```bash
# Using helper script
./scripts/deploy-local.sh start

# Or manually with docker compose
docker compose up -d
```

### 4. Access Services

- **API**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Nginx**: http://localhost:80

### 5. View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f bot
```

### 6. Stop Services

```bash
./scripts/deploy-local.sh stop
```

---

## VPS Setup

### 1. Run Initial Setup Script

**For private repositories:**

```bash
# On your local machine, copy setup script to VPS
scp scripts/setup-vps.sh root@YOUR_VPS_IP:~/

# SSH into VPS
ssh root@YOUR_VPS_IP

# Make executable
chmod +x setup-vps.sh

# Run as root
sudo bash setup-vps.sh
```

**For public repositories (alternative):**

```bash
# SSH into your VPS
ssh root@YOUR_VPS_IP

# Download setup script
wget https://raw.githubusercontent.com/your-username/motiv-buy/main/scripts/setup-vps.sh

# Make executable
chmod +x setup-vps.sh

# Run as root
sudo bash setup-vps.sh
```

This script will:
- Install Docker and Docker Compose
- Create deployment user (`deployer`)
- Setup firewall (UFW)
- Install fail2ban
- Configure automatic security updates
- Create deployment directories

### 2. Generate SSH Key for GitHub Actions

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/motiv-buy-deploy

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/motiv-buy-deploy.pub deployer@YOUR_VPS_IP
```

### 3. Setup Environment File on VPS

```bash
# SSH into VPS
ssh deployer@YOUR_VPS_IP

# Create .env file
nano /opt/motiv-buy/.env
```

Copy contents from `.env.production.example` and fill in actual values:

```env
NODE_ENV=production
DB_NAME=motiv_buy_prod
DB_USER=motiv_buy_user
DB_PASSWORD=YOUR_SECURE_PASSWORD
# ... etc
```

### 4. Setup SSL/TLS (Production Only)

```bash
# Install Certbot (if not already installed)
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d api.yourdomain.com -d yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## GitHub Secrets Configuration

### Required Secrets for Staging

Navigate to: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

**Staging Secrets:**

```
VPS_STAGING_HOST=<staging-vps-ip>
VPS_STAGING_USER=deployer
VPS_STAGING_SSH_KEY=<contents-of-private-key-file>
VPS_STAGING_DEPLOY_PATH=/opt/motiv-buy

STAGING_DB_NAME=motiv_buy_staging
STAGING_DB_USER=postgres
STAGING_DB_PASSWORD=<secure-password>
STAGING_REDIS_PASSWORD=<secure-password>
STAGING_JWT_SECRET=<generate-with-openssl-rand-base64-64>
STAGING_TELEGRAM_BOT_TOKEN=<bot-token>
STAGING_CRYPTO_BOT_API_KEY=<api-key>
```

**Production Secrets:**

```
VPS_PRODUCTION_HOST=<production-vps-ip>
VPS_PRODUCTION_USER=deployer
VPS_PRODUCTION_SSH_KEY=<contents-of-private-key-file>
VPS_PRODUCTION_DEPLOY_PATH=/opt/motiv-buy

PRODUCTION_DB_NAME=motiv_buy_prod
PRODUCTION_DB_USER=motiv_buy_user
PRODUCTION_DB_PASSWORD=<very-secure-password>
PRODUCTION_REDIS_PASSWORD=<very-secure-password>
PRODUCTION_JWT_SECRET=<generate-with-openssl-rand-base64-64>
PRODUCTION_TELEGRAM_BOT_TOKEN=<production-bot-token>
PRODUCTION_CRYPTO_BOT_API_KEY=<production-api-key>
PRODUCTION_DOMAIN=yourdomain.com
LETSENCRYPT_EMAIL=admin@yourdomain.com
```

### Generate Secure Secrets

```bash
# JWT Secret (64 characters)
openssl rand -base64 64

# Database Password (32 characters)
openssl rand -base64 32

# Redis Password (32 characters)
openssl rand -base64 32
```

---

## Deployment Process

### Staging Deployment

**Automatic**: Push to any branch except `main`

```bash
git checkout -b feature/new-feature
git add .
git commit -m "Add new feature"
git push origin feature/new-feature
```

GitHub Actions will:
1. Run CI checks (lint, test, build)
2. Build Docker images
3. Push to GitHub Container Registry
4. Deploy to staging VPS
5. Run health checks

### Production Deployment

**Automatic**: Push to `main` or create a version tag

```bash
# Option 1: Merge to main
git checkout main
git merge feature/new-feature
git push origin main

# Option 2: Create version tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

GitHub Actions will:
1. Run full CI pipeline
2. Build production Docker images
3. Backup database
4. Deploy to production VPS
5. Run migrations
6. Run health checks
7. Run smoke tests

### Manual Deployment

SSH into VPS and run:

```bash
cd /opt/motiv-buy

# Pull latest images
docker compose pull

# Run migrations
docker compose run --rm api node dist/apps/api/main.js migrate

# Deploy
docker compose up -d

# Check status
docker compose ps
```

---

## Monitoring & Maintenance

### View Application Logs

```bash
# SSH into VPS
ssh deployer@YOUR_VPS_IP

cd /opt/motiv-buy

# View all logs
docker compose logs -f

# View specific service
docker compose logs -f api
docker compose logs -f bot

# View last 100 lines
docker compose logs --tail=100 api
```

### Check Service Health

```bash
# Check running containers
docker compose ps

# Check API health
curl http://localhost:3000/health

# Check resource usage
docker stats
```

### Database Backups

Automatic backups are created before each production deployment.

**Manual Backup:**

```bash
# Create backup
docker compose exec postgres pg_dump -U $DB_USER $DB_NAME > backup-$(date +%Y%m%d-%H%M%S).sql

# Restore backup
cat backup-20240101-120000.sql | docker compose exec -T postgres psql -U $DB_USER $DB_NAME
```

### Update SSL Certificates

Certbot auto-renews certificates. To manually renew:

```bash
sudo certbot renew
sudo systemctl reload nginx
```

### Clean Up Docker Resources

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove unused containers
docker container prune
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs api

# Check if port is in use
sudo lsof -i :3000

# Restart service
docker compose restart api
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker compose ps postgres

# Check database logs
docker compose logs postgres

# Verify environment variables
docker compose exec api env | grep DB_
```

### API Returns 502 Bad Gateway

```bash
# Check if API container is running
docker compose ps api

# Check API logs
docker compose logs api

# Check Nginx logs
docker compose logs nginx

# Verify Nginx configuration
docker compose exec nginx nginx -t
```

### High Memory Usage

```bash
# Check resource usage
docker stats

# Restart containers
docker compose restart

# Check for memory leaks in logs
docker compose logs api | grep -i "memory\|heap"
```

---

## Rollback Procedures

### Automatic Rollback

If health checks fail during deployment, the workflow attempts automatic rollback.

### Manual Rollback

```bash
# SSH into VPS
ssh deployer@YOUR_VPS_IP
cd /opt/motiv-buy

# Option 1: Deploy previous image tag
export IMAGE_TAG=v1.0.0  # or specific commit SHA
docker compose pull
docker compose up -d

# Option 2: Restore from backup
# Stop services
docker compose down

# Restore database
cat /backup/motiv-buy/db-backup-YYYYMMDD-HHMMSS.sql | \
  docker compose exec -T postgres psql -U $DB_USER $DB_NAME

# Start services
docker compose up -d
```

### Emergency Rollback via GitHub

```bash
# Revert last commit
git revert HEAD
git push origin main

# Or checkout previous version
git checkout v1.0.0
git push origin main --force  # Use with caution!
```

---

## Security Best Practices

1. **Never commit `.env` files** - They are gitignored
2. **Use strong passwords** - Generate with `openssl rand -base64 32`
3. **Rotate secrets regularly** - Update in GitHub Secrets and VPS
4. **Keep system updated** - Run `sudo apt update && sudo apt upgrade` regularly
5. **Monitor logs** - Check for suspicious activity
6. **Use fail2ban** - Already configured in VPS setup script
7. **Enable firewall** - Only allow necessary ports (22, 80, 443)
8. **Use SSH keys** - Disable password authentication

---

## Support & Resources

- **Repository**: https://github.com/your-username/motiv-buy
- **Issues**: https://github.com/your-username/motiv-buy/issues
- **Documentation**: `/docs` directory

---

## Quick Reference

### Common Commands

```bash
# Local development
./scripts/deploy-local.sh start|stop|restart|logs|build|clean

# Check deployment status
ssh deployer@VPS_IP "cd /opt/motiv-buy && docker compose ps"

# View production logs
ssh deployer@VPS_IP "cd /opt/motiv-buy && docker compose logs -f api"

# Create manual backup
ssh deployer@VPS_IP "docker compose exec postgres pg_dump -U \$DB_USER \$DB_NAME > backup.sql"
```

### Important Paths

- Deployment directory: `/opt/motiv-buy`
- Backups: `/backup/motiv-buy`
- Nginx config: `/opt/motiv-buy/docker/nginx`
- SSL certificates: `/etc/letsencrypt/live/yourdomain.com`

---

**Last Updated**: 2024-01-01
