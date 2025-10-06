# Quick Service Setup Guide

## Prerequisites Needed

Before running the applications, you need these services:

1. **PostgreSQL** (port 5432) - Required by all apps
2. **Redis** (port 6379) - Already running but needs auth config
3. **Telegram Bot Token** - For bot app

---

## 1. Start PostgreSQL

### Option A: Using Docker (Recommended)

```bash
docker run -d \
  --name motiv-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=motivbuy \
  -e POSTGRES_USER=postgres \
  -p 5432:5432 \
  postgres:16-alpine
```

### Option B: Using OrbStack (If installed)

```bash
orbctl create postgres \
  --name motiv-postgres \
  --port 5432
```

### Option C: Using Homebrew

```bash
brew install postgresql@16
brew services start postgresql@16

# Create database
createdb motivbuy
```

### Verify PostgreSQL is running:

```bash
# Check if port 5432 is listening
lsof -i :5432

# Or try to connect
psql -h localhost -U postgres -d motivbuy
```

---

## 2. Fix Redis Authentication

Redis is already running on port 6379, but needs auth configuration.

### Check current Redis password:

```bash
# Check .env file for REDIS_PASSWORD
grep REDIS_PASSWORD .env
```

### Option A: Update .env with correct password

If you know the Redis password, update it in `.env`:

```env
REDIS_PASSWORD=your_actual_redis_password
```

### Option B: Disable Redis auth (Development only)

```bash
# Find Redis config
redis-cli CONFIG GET requirepass

# Disable password (if using OrbStack/Docker)
docker exec -it <redis-container> redis-cli CONFIG SET requirepass ""

# Or edit redis.conf and comment out:
# requirepass your_password
```

### Verify Redis connection:

```bash
# Test connection
redis-cli ping
# Should return: PONG

# Test with auth
redis-cli -a your_password ping
```

---

## 3. Set Telegram Bot Token

### Get a bot token:

1. Open Telegram and find @BotFather
2. Send `/newbot` and follow instructions
3. Copy the token (format: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Update .env:

```env
BOT_TOKEN=your_actual_bot_token_from_botfather
```

---

## 4. Run Database Migrations

After PostgreSQL is running:

```bash
# Check migration status
pnpm migration:status

# Run migrations
pnpm migration:run
```

---

## 5. Start Development

### Start all services:

```bash
pnpm dev
```

This runs all 3 apps in parallel:
- API on http://localhost:3000/api
- Telegram Bot (polling mode)
- Migration CLI (on-demand)

### Or start individually:

```bash
# API server
pnpm dev:api

# Telegram bot
pnpm dev:bot

# Migration CLI (with arguments)
pnpm dev:migration status
pnpm dev:migration up
```

---

## Verification Checklist

- [ ] PostgreSQL running on port 5432
- [ ] Redis running on port 6379 (already running)
- [ ] Redis password configured in .env
- [ ] Telegram BOT_TOKEN in .env
- [ ] Database created and migrations run
- [ ] `pnpm dev:api` starts without errors
- [ ] `pnpm dev:bot` connects successfully
- [ ] Swagger docs accessible at http://localhost:3000/api/docs

---

## Troubleshooting

### "ECONNREFUSED on port 5432"
PostgreSQL is not running. See section 1.

### "WRONGPASS invalid username-password pair"
Redis password mismatch. See section 2.

### "Call to 'getMe' failed! (404: Not Found)"
Invalid Telegram bot token. See section 3.

### Migration CLI not working
Run with explicit arguments:
```bash
pnpm dev:migration status
pnpm dev:migration up
```

---

## Environment Variables Required

Minimum required in `.env`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=motivbuy
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# Telegram
BOT_TOKEN=your_bot_token_from_botfather

# API
PORT=3000
API_PREFIX=api
NODE_ENV=development
CORS_ENABLED=true
```

---

## Quick Start (TL;DR)

```bash
# 1. Start PostgreSQL
docker run -d --name motiv-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=motivbuy \
  -p 5432:5432 postgres:16-alpine

# 2. Update .env with your credentials
# Edit: REDIS_PASSWORD, BOT_TOKEN

# 3. Run migrations
pnpm migration:run

# 4. Start all services
pnpm dev
```

---

## Success Indicators

When everything is working, you should see:

**API:**
```
🚀 API Application is running on: http://0.0.0.0:3000/api
📚 Swagger documentation: http://0.0.0.0:3000/api/docs
```

**Bot:**
```
🤖 Telegram Bot Application is running
🌍 Environment: development
```

**Migration CLI:**
```
✅ Database connection established
✅ Migrations applied successfully
```
