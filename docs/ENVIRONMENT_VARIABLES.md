# Environment Variables Reference

Complete reference for all environment variables used in the motiv-buy project.

## Table of Contents

1. [Critical Required Variables](#critical-required-variables)
2. [Database Configuration](#database-configuration)
3. [Redis Configuration](#redis-configuration)
4. [Authentication](#authentication)
5. [Telegram Bot Configuration](#telegram-bot-configuration)
6. [Payment Provider Configuration](#payment-provider-configuration)
7. [Application Configuration](#application-configuration)
8. [Docker & Deployment](#docker--deployment)
9. [Logging & Monitoring](#logging--monitoring)
10. [Quick Start Guide](#quick-start-guide)

---

## Critical Required Variables

These **MUST** be configured for the application to run:

| Variable      | Description                       | Example                          | Required |
| ------------- | --------------------------------- | -------------------------------- | -------- |
| `NODE_ENV`    | Application environment           | `development`, `production`      | ✅ Yes   |
| `DB_HOST`     | PostgreSQL hostname               | `postgres`, `localhost`          | ✅ Yes   |
| `DB_PORT`     | PostgreSQL port                   | `5432`                           | ✅ Yes   |
| `DB_NAME`     | Database name                     | `motiv_buy_dev`                  | ✅ Yes   |
| `DB_USER`     | Database username                 | `postgres`                       | ✅ Yes   |
| `DB_PASSWORD` | Database password                 | `strong_password_here`           | ✅ Yes   |
| `JWT_SECRET`  | JWT signing key (64+ chars)       | `openssl rand -base64 64`        | ✅ Yes   |
| `TELEGRAM_BOT_TOKEN`   | Telegram bot token                | `123456:ABC-DEF...`              | ✅ Yes   |
| `REDIS_MODE`  | Redis mode                        | `default`, `cluster`, `sentinel` | ✅ Yes   |
| `REDIS_HOSTS` | Redis host:port (comma-separated) | `redis:6379`                     | ✅ Yes   |

---

## Database Configuration

### PostgreSQL Connection

| Variable      | Description                   | Default         | Required |
| ------------- | ----------------------------- | --------------- | -------- |
| `DB_HOST`     | PostgreSQL server hostname    | `postgres`      | ✅ Yes   |
| `DB_PORT`     | PostgreSQL server port        | `5432`          | ✅ Yes   |
| `DB_NAME`     | Database name                 | `motiv_buy_dev` | ✅ Yes   |
| `DB_USER`     | Database username             | `postgres`      | ✅ Yes   |
| `DB_PASSWORD` | Database password             | -               | ✅ Yes   |
| `DB_DEBUG`    | Enable database query logging | `false`         | ❌ No    |

### Migration Configuration (apps/migration only)

| Variable                       | Description                    | Default                          | Required |
| ------------------------------ | ------------------------------ | -------------------------------- | -------- |
| `DB_MIGRATIONS_PATH`           | Path to migration files        | `./apps/migration/src/migration` | ✅ Yes   |
| `DB_MIGRATIONS_TABLE`          | Migration tracking table name  | `mikro_orm_migrations`           | ❌ No    |
| `DB_MIGRATIONS_TRANSACTIONAL`  | Run migrations in transactions | `true`                           | ❌ No    |
| `DB_MIGRATIONS_ALL_OR_NOTHING` | Rollback all on failure        | `true`                           | ❌ No    |
| `DB_MIGRATIONS_SAFE`           | Safe mode (no drops)           | `false`                          | ❌ No    |
| `DB_MIGRATIONS_EMIT`           | Migration file format          | `ts`                             | ❌ No    |

---

## Redis Configuration

Redis can be configured in three modes: `default`, `cluster`, or `sentinel`.

### Mode: default (Single Instance)

```bash
REDIS_MODE=default
REDIS_HOSTS=redis:6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
```

### Mode: cluster (Redis Cluster)

```bash
REDIS_MODE=cluster
REDIS_HOSTS=redis1:6379,redis2:6379,redis3:6379
REDIS_PASSWORD=your_redis_password
# Note: REDIS_DB is not allowed in cluster mode
```

### Mode: sentinel (Redis Sentinel)

```bash
REDIS_MODE=sentinel
REDIS_HOSTS=sentinel1:26379,sentinel2:26379,sentinel3:26379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
REDIS_SENTINEL_GROUP_IDENTIFIER=mymaster
```

### Redis Variables

| Variable                          | Description                       | Default   | Required                  |
| --------------------------------- | --------------------------------- | --------- | ------------------------- |
| `REDIS_MODE`                      | Redis operation mode              | `default` | ✅ Yes                    |
| `REDIS_HOSTS`                     | Redis host:port (comma-separated) | -         | ✅ Yes                    |
| `REDIS_PASSWORD`                  | Redis authentication password     | -         | ❌ No                     |
| `REDIS_DB`                        | Redis database number (0-15)      | `0`       | Only for default/sentinel |
| `REDIS_SENTINEL_GROUP_IDENTIFIER` | Sentinel master name              | -         | Only for sentinel mode    |

---

## Authentication

| Variable         | Description                                                | Default | Required |
| ---------------- | ---------------------------------------------------------- | ------- | -------- |
| `JWT_SECRET`     | Secret key for JWT signing (min 32 chars, recommended 64+) | -       | ✅ Yes   |
| `JWT_EXPIRES_IN` | JWT token expiration time                                  | `7d`    | ❌ No    |

**Generate secure JWT secret:**

```bash
openssl rand -base64 64
```

---

## Telegram Bot Configuration

### Core Bot Settings

| Variable           | Description                        | Default | Required |
| ------------------ | ---------------------------------- | ------- | -------- |
| `TELEGRAM_BOT_TOKEN`        | Telegram bot token from @BotFather | -       | ✅ Yes   |
| `BOT_USERNAME`     | Bot username (without @)           | -       | ❌ No    |
| `BOT_DISPLAY_NAME` | Bot display name                   | -       | ❌ No    |
| `BOT_DESCRIPTION`  | Bot description                    | -       | ❌ No    |
| `BOT_VERSION`      | Bot version                        | `1.0.0` | ❌ No    |
| `BOT_DEBUG`        | Enable debug mode                  | `false` | ❌ No    |
| `BOT_VERBOSE`      | Enable verbose logging             | `false` | ❌ No    |

### Bot Admin Configuration

| Variable        | Description                                         | Default | Required |
| --------------- | --------------------------------------------------- | ------- | -------- |
| `BOT_ADMIN_IDS` | Comma-separated Telegram user IDs with admin access | -       | ❌ No    |

**Example:**

```bash
BOT_ADMIN_IDS=123456789,987654321
```

### Bot Moderation Channel

| Variable                         | Description                                      | Default | Required |
| -------------------------------- | ------------------------------------------------ | ------- | -------- |
| `TELEGRAM_MODERATION_CHANNEL_ID` | Telegram channel ID for moderation notifications | -       | ❌ No    |

**Purpose:**
Sends moderation requests to a Telegram channel where admins can approve or decline traffic sources and orders.

**Features:**

- Automatic notifications for new traffic sources and orders
- Inline approve/decline buttons in the channel
- Updates messages with reviewer name and decision
- Optional configuration (if not set, moderation notifications are disabled)

**Example:**

```bash
# Numeric channel ID (recommended)
TELEGRAM_MODERATION_CHANNEL_ID=-1001234567890

# Or channel username
TELEGRAM_MODERATION_CHANNEL_ID=@your_moderation_channel
```

**How to get Channel ID:**

1. Create a Telegram channel
2. Add your bot as an administrator
3. Get the channel ID using @userinfobot or from bot API
4. Use the numeric ID format (e.g., `-1001234567890`)

### Bot Webhook Configuration

| Variable                      | Description                  | Default    | Required                       |
| ----------------------------- | ---------------------------- | ---------- | ------------------------------ |
| `BOT_WEBHOOK_URL`             | Public webhook URL           | -          | ❌ No (use polling if not set) |
| `BOT_WEBHOOK_SECRET`          | Webhook secret token         | -          | ❌ No                          |
| `BOT_WEBHOOK_PORT`            | Webhook server port          | `3000`     | ❌ No                          |
| `BOT_WEBHOOK_PATH`            | Webhook endpoint path        | `/webhook` | ❌ No                          |
| `BOT_WEBHOOK_MAX_CONNECTIONS` | Max simultaneous connections | `40`       | ❌ No                          |

### Bot Polling Configuration

| Variable                   | Description                    | Default | Required |
| -------------------------- | ------------------------------ | ------- | -------- |
| `BOT_POLLING_TIMEOUT`      | Long polling timeout (seconds) | `30`    | ❌ No    |
| `BOT_POLLING_LIMIT`        | Max updates per request        | `100`   | ❌ No    |
| `BOT_DROP_PENDING_UPDATES` | Drop pending updates on start  | `false` | ❌ No    |

### Bot Session Management

| Variable                       | Description                      | Default | Required |
| ------------------------------ | -------------------------------- | ------- | -------- |
| `BOT_SESSION_TIMEOUT`          | Session timeout (seconds)        | `3600`  | ❌ No    |
| `BOT_SESSION_CLEANUP_INTERVAL` | Cleanup interval (seconds)       | `300`   | ❌ No    |
| `BOT_MAX_SESSIONS_PER_USER`    | Max concurrent sessions per user | `5`     | ❌ No    |

### Bot Rate Limiting

| Variable                 | Description                 | Default | Required |
| ------------------------ | --------------------------- | ------- | -------- |
| `BOT_RATE_LIMIT_ENABLED` | Enable rate limiting        | `true`  | ❌ No    |
| `BOT_RATE_LIMIT_RPM`     | Requests per minute         | `30`    | ❌ No    |
| `BOT_RATE_LIMIT_BURST`   | Burst capacity              | `5`     | ❌ No    |
| `BOT_RATE_LIMIT_WINDOW`  | Rate limit window (seconds) | `60`    | ❌ No    |

### Bot Logging

| Variable         | Description   | Default | Required |
| ---------------- | ------------- | ------- | -------- |
| `BOT_LOG_LEVEL`  | Logging level | `info`  | ❌ No    |
| `BOT_LOG_FORMAT` | Log format    | `json`  | ❌ No    |

**Valid values:**

- `BOT_LOG_LEVEL`: `debug`, `info`, `warn`, `error`
- `BOT_LOG_FORMAT`: `json`, `text`

---

## Payment Provider Configuration

**At least ONE payment provider must be configured for payments to work.**

### CryptoBot (Crypto Pay)

| Variable                     | Description               | Default        | Required      |
| ---------------------------- | ------------------------- | -------------- | ------------- |
| `CRYPTO_BOT_API_TOKEN`       | CryptoBot API token       | -              | For CryptoBot |
| `CRYPTO_BOT_API_URL`         | CryptoBot API endpoint    | Production URL | ❌ No         |
| `CRYPTO_BOT_TESTNET`         | Use testnet               | `false`        | ❌ No         |
| `CRYPTO_BOT_TIMEOUT`         | API timeout (ms)          | `10000`        | ❌ No         |
| `CRYPTO_BOT_MAX_RETRIES`     | Max retry attempts        | `3`            | ❌ No         |
| `CRYPTO_BOT_UPDATE_STRATEGY` | Update strategy           | `HYBRID`       | ❌ No         |
| `CRYPTO_BOT_WEBHOOK_URL`     | Webhook URL for CryptoBot | -              | ❌ No         |
| `CRYPTO_BOT_WEBHOOK_SECRET`  | Webhook secret            | -              | ❌ No         |
| `CRYPTO_BOT_WEBHOOK_TIMEOUT` | Webhook timeout (seconds) | `30`           | ❌ No         |
| `CRYPTO_BOT_WEBHOOK_VERIFY`  | Verify webhook signatures | `true`         | ❌ No         |

**API URLs:**

- Production: `https://pay.crypt.bot/api`
- Testnet: `https://testnet-pay.crypt.bot/api`

**Update Strategies:** `WEBHOOK`, `POLLING`, `HYBRID`

### Heleket Payment Gateway

| Variable                  | Description                  | Default                      | Required    |
| ------------------------- | ---------------------------- | ---------------------------- | ----------- |
| `HELEKET_API_TOKEN`       | Heleket API token            | -                            | For Heleket |
| `HELEKET_MERCHANT_ID`     | Heleket merchant ID          | -                            | For Heleket |
| `HELEKET_API_URL`         | Heleket API endpoint         | `https://api.heleket.com/v1` | ❌ No       |
| `HELEKET_TEST_MODE`       | Use test mode                | `false`                      | ❌ No       |
| `HELEKET_TIMEOUT`         | API timeout (ms)             | `10000`                      | ❌ No       |
| `HELEKET_MAX_RETRIES`     | Max retry attempts           | `3`                          | ❌ No       |
| `HELEKET_SUCCESS_URL`     | Payment success redirect URL | -                            | ❌ No       |
| `HELEKET_FAIL_URL`        | Payment failure redirect URL | -                            | ❌ No       |
| `HELEKET_UPDATE_STRATEGY` | Update strategy              | `HYBRID`                     | ❌ No       |
| `HELEKET_WEBHOOK_URL`     | Webhook URL for Heleket      | -                            | ❌ No       |

### YooKassa Payment Gateway

| Variable                   | Description                           | Default                      | Required     |
| -------------------------- | ------------------------------------- | ---------------------------- | ------------ |
| `YOOKASSA_SHOP_ID`         | YooKassa shop ID                      | -                            | For YooKassa |
| `YOOKASSA_SECRET_KEY`      | YooKassa secret key                   | -                            | For YooKassa |
| `YOOKASSA_API_URL`         | YooKassa API endpoint                 | `https://api.yookassa.ru/v3` | ❌ No        |
| `YOOKASSA_TEST_MODE`       | Use test mode                         | `false`                      | ❌ No        |
| `YOOKASSA_TIMEOUT`         | API timeout (ms)                      | `10000`                      | ❌ No        |
| `YOOKASSA_MAX_RETRIES`     | Max retry attempts                    | `3`                          | ❌ No        |
| `YOOKASSA_RETURN_URL`      | Payment return URL                    | -                            | ❌ No        |
| `YOOKASSA_UPDATE_STRATEGY` | Update strategy                       | `HYBRID`                     | ❌ No        |
| `YOOKASSA_WEBHOOK_URL`     | Webhook URL for YooKassa              | -                            | ❌ No        |
| `YOOKASSA_WEBHOOK_IPS`     | Allowed webhook IPs (comma-separated) | -                            | ❌ No        |

**Example:**

```bash
YOOKASSA_WEBHOOK_IPS=185.71.76.0/27,185.71.77.0/27,77.75.153.0/25
```

### Payment Features & Limits

| Variable                      | Description                  | Default     | Required |
| ----------------------------- | ---------------------------- | ----------- | -------- |
| `PAYMENT_FEATURE_TOPUP`       | Enable top-up feature        | `true`      | ❌ No    |
| `PAYMENT_FEATURE_WITHDRAWAL`  | Enable withdrawal feature    | `true`      | ❌ No    |
| `PAYMENT_FEATURE_HISTORY`     | Enable payment history       | `true`      | ❌ No    |
| `PAYMENT_FEATURE_AUTO_CREDIT` | Enable auto-credit           | `true`      | ❌ No    |
| `PAYMENT_FEATURE_TESTNET`     | Enable testnet currencies    | `false`     | ❌ No    |
| `PAYMENT_MIN_TOPUP`           | Minimum top-up amount        | `1.00`      | ❌ No    |
| `PAYMENT_MAX_TOPUP`           | Maximum top-up amount        | `100000.00` | ❌ No    |
| `PAYMENT_MIN_WITHDRAWAL`      | Minimum withdrawal amount    | `1.00`      | ❌ No    |
| `PAYMENT_MAX_WITHDRAWAL`      | Maximum withdrawal amount    | `100000.00` | ❌ No    |
| `PAYMENT_INVOICE_EXPIRATION`  | Invoice expiration (seconds) | `86400`     | ❌ No    |
| `PAYMENT_MAX_TX_PER_DAY`      | Max transactions per day     | `100`       | ❌ No    |

### Payment Polling Configuration

| Variable                          | Description               | Default | Required |
| --------------------------------- | ------------------------- | ------- | -------- |
| `PAYMENT_POLLING_ENABLED`         | Enable payment polling    | `true`  | ❌ No    |
| `PAYMENT_POLLING_INTERVAL`        | Polling interval (ms)     | `30000` | ❌ No    |
| `PAYMENT_POLLING_MAX_PENDING_AGE` | Max pending age (minutes) | `1440`  | ❌ No    |
| `PAYMENT_POLLING_BATCH_SIZE`      | Batch size for polling    | `50`    | ❌ No    |
| `PAYMENT_POLLING_CRYPTOBOT`       | Poll CryptoBot            | `true`  | ❌ No    |
| `PAYMENT_POLLING_HELEKE`          | Poll Heleket              | `true`  | ❌ No    |
| `PAYMENT_POLLING_YOOKASSA`        | Poll YooKassa             | `true`  | ❌ No    |

---

## Application Configuration

| Variable       | Description         | Default       | Required |
| -------------- | ------------------- | ------------- | -------- |
| `NODE_ENV`     | Node environment    | `development` | ✅ Yes   |
| `API_PORT`     | API server port     | `3000`        | ❌ No    |
| `API_URL`      | API base URL        | -             | ❌ No    |
| `FRONTEND_URL` | Frontend URL        | -             | ❌ No    |
| `TRUST_PROXY`  | Trust proxy headers | `false`       | ❌ No    |

---

## Docker & Deployment

| Variable              | Description                 | Default           | Required   |
| --------------------- | --------------------------- | ----------------- | ---------- |
| `DOCKER_REGISTRY`     | Docker registry URL         | `ghcr.io`         | ❌ No      |
| `DOCKER_IMAGE_PREFIX` | Image name prefix           | `nmime/motiv-buy` | ❌ No      |
| `IMAGE_TAG`           | Docker image tag            | `latest`          | ❌ No      |
| `PROJECT_NAME`        | Docker Compose project name | -                 | For Docker |
| `NGINX_HTTP_PORT`     | Nginx HTTP port             | `80`              | ❌ No      |
| `NGINX_HTTPS_PORT`    | Nginx HTTPS port            | `443`             | ❌ No      |

### Production Deployment

| Variable            | Description             | Default | Required       |
| ------------------- | ----------------------- | ------- | -------------- |
| `DOMAIN`            | Primary domain          | -       | For production |
| `API_DOMAIN`        | API subdomain           | -       | For production |
| `LETSENCRYPT_EMAIL` | Email for Let's Encrypt | -       | For SSL        |

---

## Logging & Monitoring

| Variable        | Description               | Default | Required |
| --------------- | ------------------------- | ------- | -------- |
| `LOG_LEVEL`     | Application log level     | `info`  | ❌ No    |
| `DEBUG`         | Enable debug mode         | `false` | ❌ No    |
| `SENTRY_DSN`    | Sentry error tracking DSN | -       | ❌ No    |
| `SLACK_WEBHOOK` | Slack webhook for alerts  | -       | ❌ No    |

**Valid log levels:** `debug`, `info`, `warn`, `error`

---

## Quick Start Guide

### 1. Development Setup

```bash
# Copy template
cp .env.example .env

# Edit .env and fill in these REQUIRED variables:
DB_PASSWORD=your_secure_password
JWT_SECRET=$(openssl rand -base64 64)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_from_botfather
REDIS_PASSWORD=your_redis_password

# Optional: Configure at least one payment provider
CRYPTO_BOT_API_TOKEN=your_crypto_bot_token
```

### 2. Production Setup

```bash
# Copy production template
cp .env.production.example .env

# Edit .env and configure:
NODE_ENV=production
DB_PASSWORD=STRONG_PASSWORD_HERE
JWT_SECRET=$(openssl rand -base64 64)
TELEGRAM_BOT_TOKEN=PRODUCTION_BOT_TOKEN
REDIS_PASSWORD=STRONG_REDIS_PASSWORD

# Domain configuration
DOMAIN=motivbuy.com
API_DOMAIN=api.motivbuy.com
LETSENCRYPT_EMAIL=admin@motivbuy.com

# Payment provider (choose at least one)
CRYPTO_BOT_API_TOKEN=PRODUCTION_TOKEN
```

### 3. Migration Setup

```bash
# For migration app
cd apps/migration
cp .env.example .env

# Configure database connection
DB_HOST=localhost
DB_NAME=motiv_buy_dev
DB_USER=postgres
DB_PASSWORD=your_password
```

### 4. Verify Configuration

```bash
# Build the project
pnpm run build

# Run migrations
pnpm run migration:run

# Start development server
pnpm run dev
```

---

## Environment-Specific Recommendations

### Development

- Use `NODE_ENV=development`
- Set `BOT_DEBUG=true` for detailed logs
- Set `DB_DEBUG=true` to see SQL queries
- Use `CRYPTO_BOT_TESTNET=true` for testing
- Set `LOG_LEVEL=debug`

### Production

- Use `NODE_ENV=production`
- Generate strong passwords (32+ characters)
- Use `JWT_SECRET` with 64+ characters
- Set `TRUST_PROXY=true` if behind proxy/CDN
- Set `LOG_LEVEL=warn` or `error`
- Configure SSL with `LETSENCRYPT_EMAIL`
- Enable monitoring with `SENTRY_DSN`

---

## Security Best Practices

1. **Never commit .env files to git**
   - `.env` is already in `.gitignore`
   - Use GitHub Secrets for CI/CD

2. **Use strong passwords**

   ```bash
   # Generate secure password
   openssl rand -base64 32

   # Generate JWT secret
   openssl rand -base64 64
   ```

3. **Rotate secrets regularly**
   - Change `JWT_SECRET` periodically
   - Update database passwords
   - Rotate API tokens

4. **Limit access**
   - Use `BOT_ADMIN_IDS` to restrict admin commands
   - Configure `YOOKASSA_WEBHOOK_IPS` for webhook security
   - Set `TRUST_PROXY=true` only when behind trusted proxy

5. **Monitor and log**
   - Configure `SENTRY_DSN` for error tracking
   - Set up `SLACK_WEBHOOK` for alerts
   - Use appropriate `LOG_LEVEL`

---

## Troubleshooting

### Common Issues

**Application won't start:**

- Check that all required variables are set
- Verify database connection (`DB_HOST`, `DB_PORT`, `DB_PASSWORD`)
- Ensure `TELEGRAM_BOT_TOKEN` is valid
- Check `REDIS_HOSTS` format: `host:port`

**Payment not working:**

- At least one payment provider must be configured
- Verify API tokens are correct
- Check API URLs (production vs testnet)
- Review `PAYMENT_POLLING_ENABLED` setting

**Redis connection fails:**

- Verify `REDIS_MODE` matches your setup
- For cluster mode, don't set `REDIS_DB`
- For sentinel mode, set `REDIS_SENTINEL_GROUP_IDENTIFIER`
- Check `REDIS_HOSTS` format: `host1:port1,host2:port2`

**Bot not responding:**

- Verify `TELEGRAM_BOT_TOKEN` is correct
- If using webhook, check `BOT_WEBHOOK_URL` is publicly accessible
- If using polling, ensure no webhook is configured
- Check Redis connection for session storage

---

## Additional Resources

- **Template Files:**
  - Development: `.env.example`
  - Production: `.env.production.example`
  - Migration: `apps/migration/.env.example`

- **Configuration Services:**
  - Database: `libs/database/src/config/database.config.ts`
  - Redis: `libs/common/redis/src/config/redis.config.service.ts`
  - Auth: `libs/feature/auth/shared/src/config/auth.config.service.ts`
  - Payment: `libs/feature/payment/shared/src/config/payment-config.service.ts`
  - Bot: `libs/feature/bot/main/src/config/bot-config.service.ts`

- **Documentation:**
  - Main guidelines: `CLAUDE.md`
  - Development: `docs/DEVELOPMENT-GUIDELINES.md`

---

**Last Updated:** 2025-11-15
**Project:** motiv-buy
**Maintainer:** nmime
