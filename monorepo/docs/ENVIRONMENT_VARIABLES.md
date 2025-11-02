# Environment Variables Reference - Motiv-Buy

## 🔴 Critical Variables (MUST BE SET FOR PRODUCTION)

These variables contain sensitive information and MUST be changed before production deployment.

### Security & Authentication

| Variable           | Current Value                                           | Production Action                             | Generate Command          |
| ------------------ | ------------------------------------------------------- | --------------------------------------------- | ------------------------- |
| `BOT_TOKEN`        | `TODO_GET_FROM_BOTFATHER`                               | Get from [@BotFather](https://t.me/BotFather) | Create bot via Telegram   |
| `JWT_SECRET`       | `TODO_GENERATE_SECURE_JWT_SECRET_MINIMUM_32_CHARACTERS` | Generate secure random string                 | `openssl rand -base64 32` |
| `DB_PASSWORD`      | `password`                                              | Generate secure password                      | `openssl rand -base64 24` |
| `REDIS_PASSWORD`   | `TODO_SECURE_REDIS_PASSWORD`                            | Generate secure password                      | `openssl rand -base64 24` |
| `GRAFANA_PASSWORD` | `TODO_SECURE_GRAFANA_PASSWORD`                          | Choose secure password                        | Manual selection          |

---

## 📋 All Environment Variables

### Project Configuration

```bash
PROJECT_NAME=motiv-buy              # Project identifier (DO NOT change)
ENV=development                      # Environment: development | staging | production
NODE_ENV=development                 # Node environment: development | production
```

### Application Settings

```bash
PORT=3000                           # API server port
HOST=0.0.0.0                        # Bind address (0.0.0.0 for all interfaces)
API_PREFIX=api/v1                   # API route prefix
CORS_ENABLED=true                   # Enable CORS (false for production if not needed)
```

### Database Configuration

```bash
DB_HOST=localhost                   # PostgreSQL hostname
DB_PORT=5432                        # PostgreSQL port
DB_USERNAME=postgres                # Database user (change to motiv_user in production)
DB_PASSWORD=password                # 🔴 MUST CHANGE for production
DB_DATABASE=motiv_buy              # Database name
DB_NAME=motiv_buy                  # Alias for DB_DATABASE
DB_USER=postgres                   # Alias for DB_USERNAME
DB_SYNCHRONIZE=false               # Auto-sync schema (NEVER true in production)
DB_LOGGING=false                   # Log SQL queries (false for production)
DB_SSL=false                       # Enable SSL for database (true for production)
```

### Telegram Bot

```bash
BOT_TOKEN=TODO_GET_FROM_BOTFATHER   # 🔴 REQUIRED: Get from @BotFather
```

### Security & JWT

```bash
JWT_SECRET=TODO_GENERATE_SECURE_JWT_SECRET_MINIMUM_32_CHARACTERS  # 🔴 REQUIRED
JWT_EXPIRES_IN=24h                  # Token expiration time
```

### Redis Configuration

```bash
REDIS_HOST=localhost                # Redis hostname
REDIS_PORT=6379                     # Redis port
REDIS_PASSWORD=TODO_SECURE_REDIS_PASSWORD  # 🔴 REQUIRED for production
REDIS_DB=2                          # Redis database index
REDIS_MODE=default                  # Redis mode: default | cluster | sentinel
REDIS_HOSTS=localhost:6379          # Redis hosts (for cluster/sentinel)
```

### Cache Configuration

```bash
CACHE_ENABLED=true                  # Enable caching
REDIS_CACHE_PREFIX=mikro-orm-cache: # Cache key prefix
CACHE_TTL=30                        # Cache TTL in seconds
CACHE_DEBUG=false                   # Debug cache operations
```

### Logging & Monitoring

```bash
LOG_LEVEL=debug                     # Log level: debug | info | warn | error
GRAFANA_PASSWORD=TODO_SECURE_GRAFANA_PASSWORD  # 🔴 REQUIRED for monitoring
```

### Development Settings

```bash
HOT_RELOAD=true                     # Enable hot reload (development only)
DEBUG_MODE=true                     # Enable debug mode (development only)
```

### Docker Port Configuration

```bash
DB_PORT_EXTERNAL=5432              # External PostgreSQL port
REDIS_PORT_EXTERNAL=6379           # External Redis port
API_PORT_EXTERNAL=3000             # External API port
HTTP_PORT=80                       # HTTP port (production)
HTTPS_PORT=443                     # HTTPS port (production)
PGADMIN_PORT=8080                 # pgAdmin web interface port
REDIS_COMMANDER_PORT=8081         # Redis Commander port
MAILCATCHER_WEB_PORT=1080         # Mailcatcher web port
MAILCATCHER_SMTP_PORT=1025        # Mailcatcher SMTP port
PROMETHEUS_PORT=9090              # Prometheus port
GRAFANA_PORT=3002                 # Grafana port
```

### Rate Limiting

```bash
RATE_LIMIT_MAX=1000               # Max requests per window
RATE_LIMIT_WINDOW=60000           # Window in milliseconds
```

### Optional Production Variables

```bash
# Sentry Error Tracking
SENTRY_DSN=TODO_YOUR_SENTRY_DSN_HERE  # Optional but recommended

# SSL/TLS Configuration
SSL_CERT_PATH=/etc/nginx/ssl/cert.pem  # SSL certificate path
SSL_KEY_PATH=/etc/nginx/ssl/key.pem    # SSL private key path
```

---

## 🔧 How to Generate Secure Values

### JWT Secret

```bash
openssl rand -base64 32
# Example output: yK8z9vXnR2mP4wQtL6hS1eF7gJ3bN5aC0dU2oI8pM9x=
```

### Database Password

```bash
openssl rand -base64 24
# Example output: kP9mN2vB6xC8sT4eR7wQ1zA5
```

### Redis Password

```bash
openssl rand -base64 24
# Example output: wX3bN7mV9cR2pK5tL8eS4gF6
```

### Telegram Bot Token

1. Open Telegram
2. Search for [@BotFather](https://t.me/BotFather)
3. Send `/newbot` command
4. Follow instructions
5. Copy the token provided

---

## 🌍 Environment-Specific Configurations

### Development (.env)

```bash
NODE_ENV=development
DB_HOST=localhost
DB_PASSWORD=password              # Simple password OK for development
JWT_SECRET=dev_secret             # Simple secret OK for development
LOG_LEVEL=debug
HOT_RELOAD=true
DEBUG_MODE=true
```

### Production (.env.production)

```bash
NODE_ENV=production
DB_HOST=postgres-prod             # Production database hostname
DB_PASSWORD=GENERATED_SECURE_PASSWORD
JWT_SECRET=GENERATED_SECURE_SECRET
LOG_LEVEL=warn                    # Less verbose logging
HOT_RELOAD=false
DEBUG_MODE=false
DB_SSL=true                       # Enable SSL
CORS_ENABLED=false                # Disable if not needed
```

### Staging (.env.staging)

```bash
NODE_ENV=staging
DB_HOST=postgres-staging
DB_PASSWORD=SECURE_STAGING_PASSWORD
JWT_SECRET=SECURE_STAGING_SECRET
LOG_LEVEL=info
```

---

## ⚠️ Security Warnings

### Never Commit These Values

**DO NOT** commit the following to version control:

- `BOT_TOKEN` - Telegram bot token
- `JWT_SECRET` - JWT signing secret
- `DB_PASSWORD` - Database password
- `REDIS_PASSWORD` - Redis password
- `GRAFANA_PASSWORD` - Grafana admin password
- `SENTRY_DSN` - Sentry DSN (contains project identifier)
- SSL certificates (_.pem, _.key, \*.crt)

### Current .gitignore Protection

The following are already in `.gitignore`:

- `.env`
- `.env.local`
- `.env.production`
- `config/nginx/ssl/*.pem`
- `config/nginx/ssl/*.key`
- `config/nginx/ssl/*.crt`

---

## 🚀 Quick Setup Guide

### Step 1: Copy Template

```bash
cd /Users/nmi/IT/Projects/motiv-buy/monorepo
cp .env.example .env
```

### Step 2: Generate Secrets

```bash
# Generate JWT secret
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env.local

# Generate database password
echo "DB_PASSWORD=$(openssl rand -base64 24)" >> .env.local

# Generate Redis password
echo "REDIS_PASSWORD=$(openssl rand -base64 24)" >> .env.local
```

### Step 3: Get Bot Token

1. Visit [@BotFather](https://t.me/BotFather) on Telegram
2. Create a new bot
3. Copy the token
4. Add to `.env`: `BOT_TOKEN=your_token_here`

### Step 4: Verify Configuration

```bash
# Check that all required variables are set
grep "TODO" .env
# This should return NO results before production deployment
```

---

## 📊 Variable Usage by Service

| Variable     | API | Bot | Database | Redis | Migration |
| ------------ | --- | --- | -------- | ----- | --------- |
| `BOT_TOKEN`  | ❌  | ✅  | ❌       | ❌    | ❌        |
| `JWT_SECRET` | ✅  | ✅  | ❌       | ❌    | ❌        |
| `DB_*`       | ✅  | ✅  | ✅       | ❌    | ✅        |
| `REDIS_*`    | ✅  | ✅  | ❌       | ✅    | ❌        |
| `PORT`       | ✅  | ❌  | ❌       | ❌    | ❌        |

---

## 🔍 Validation Checklist

Before deployment, verify:

- [ ] No `TODO` values in .env file
- [ ] `JWT_SECRET` is at least 32 characters
- [ ] `BOT_TOKEN` is a valid Telegram bot token
- [ ] `DB_PASSWORD` is strong (16+ characters, mixed case, numbers, symbols)
- [ ] `REDIS_PASSWORD` is strong (16+ characters)
- [ ] `NODE_ENV` is set to `production`
- [ ] `DB_SSL` is `true` for production
- [ ] `LOG_LEVEL` is `warn` or `error` for production
- [ ] `DEBUG_MODE` is `false` for production
- [ ] `HOT_RELOAD` is `false` for production

---

**Last Updated**: 2025-10-03
**Version**: 1.0.0
