# Production Deployment Guide - Critical Recommendations

## Overview

This document addresses the remaining medium-priority issues and provides recommendations for production deployment of the motiv-buy payment and bot systems.

---

## 🔴 MEDIUM: Redis-Based Rate Limiting

### Current Implementation Issue

**File:** `monorepo/libs/feature/bot/main/src/middleware/rate-limit.middleware.ts:25`

**Problem:**
```typescript
private readonly rateLimitStore = new Map<string, RateLimitEntry>();
```
- Uses in-memory storage for rate limit tracking
- **Does NOT work in multi-instance deployments**
- Users can bypass limits by hitting different server instances

**Attack Scenario:**
```
Server Instance 1: User sends 20 requests (limit reached)
Server Instance 2: User sends 20 requests (limit reached)
Server Instance 3: User sends 20 requests (limit reached)
= 60 requests total (3x the intended limit!)
```

### Recommended Fix

#### Option 1: Redis with ioredis (Recommended)

**Install dependencies:**
```bash
pnpm add ioredis @types/ioredis
```

**Update rate-limit.middleware.ts:**
```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0,
      keyPrefix: 'rate-limit:',
    });
  }

  async use(req: any, res: any, next: () => void) {
    const userId = req.user?.id || req.ip;
    const key = `${req.path}:${userId}`;

    // Increment counter with expiration
    const current = await this.redis.incr(key);

    if (current === 1) {
      // First request, set expiration
      await this.redis.expire(key, this.getWindowSeconds());
    }

    if (current > this.getLimit(req.path)) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: await this.redis.ttl(key),
      });
    }

    next();
  }
}
```

**Benefits:**
- ✅ Works across multiple server instances
- ✅ Automatic cleanup via Redis expiration
- ✅ Persistent across server restarts
- ✅ High performance (Redis is in-memory)

#### Option 2: NestJS Throttler with Redis (Recommended Alternative)

**Install:**
```bash
pnpm add @nestjs/throttler @nestjs/throttler-storage-redis ioredis
```

**Configure in module:**
```typescript
import { ThrottlerModule, ThrottlerStorageRedisService } from '@nestjs/throttler';
import Redis from 'ioredis';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000, // 1 minute
            limit: 20, // 20 requests
          },
          {
            name: 'withdrawals',
            ttl: 3600000, // 1 hour
            limit: 3, // 3 withdrawals
          },
        ],
        storage: new ThrottlerStorageRedisService(
          new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
          }),
        ),
      }),
    }),
  ],
})
export class AppModule {}
```

**Benefits:**
- ✅ Built-in NestJS integration
- ✅ Distributed rate limiting
- ✅ Simpler configuration
- ✅ Production-tested

###Environment Variables

Add to `.env`:
```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# For production with Sentinel
REDIS_SENTINEL_HOST=sentinel-1,sentinel-2,sentinel-3
REDIS_SENTINEL_PORT=26379
REDIS_SENTINEL_NAME=mymaster
```

### Docker Compose Setup

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3

volumes:
  redis-data:
```

### Testing

```bash
# Test rate limiting across instances
# Start 2 server instances
npm run start:dev & npm run start:dev

# Make rapid requests
for i in {1..50}; do
  curl http://localhost:3000/api/bot/callback
done

# Verify: Should be rate limited after 20 requests (not 40)
```

---

## 🗃️ Database Index Recommendations

### Problem

Webhook processing queries `provider_transaction_id` frequently without index, causing slow queries.

**File:** `monorepo/libs/feature/payment/main/src/entity/payment-transaction.entity.ts`

### Recommended Indexes

**Add to migration:**
```sql
-- Index for webhook lookups (high frequency)
CREATE INDEX CONCURRENTLY idx_payment_transactions_provider_id
ON payment_transactions(provider_transaction_id);

-- Index for user transaction history
CREATE INDEX CONCURRENTLY idx_payment_transactions_user_status
ON payment_transactions(user_id, status, created_at DESC);

-- Index for pending transaction cleanup
CREATE INDEX CONCURRENTLY idx_payment_transactions_status_created
ON payment_transactions(status, created_at)
WHERE status IN ('PENDING', 'PROCESSING');

-- Partial index for webhook processing
CREATE INDEX CONCURRENTLY idx_payment_transactions_webhook_pending
ON payment_transactions(provider_transaction_id, status)
WHERE status = 'PENDING';
```

**Add to entity (TypeORM/MikroORM):**
```typescript
@Entity({ tableName: 'payment_transactions' })
@Index({ name: 'idx_provider_transaction_id', properties: ['providerTransactionId'] })
@Index({ name: 'idx_user_status_created', properties: ['userId', 'status', 'createdAt'] })
@Index({
  name: 'idx_webhook_pending',
  properties: ['providerTransactionId', 'status'],
  where: "status = 'PENDING'",
})
export class PaymentTransactionEntity {
  // ...
}
```

### Performance Impact

**Before (without index):**
```
EXPLAIN ANALYZE SELECT * FROM payment_transactions
WHERE provider_transaction_id = 'INV123';

Seq Scan on payment_transactions  (cost=0.00..1234.56 rows=1 width=100) (actual time=45.234..45.234 rows=1 loops=1)
Planning Time: 0.123 ms
Execution Time: 45.367 ms  <-- SLOW
```

**After (with index):**
```
Index Scan using idx_provider_transaction_id on payment_transactions  (cost=0.29..8.31 rows=1 width=100) (actual time=0.045..0.046 rows=1 loops=1)
Planning Time: 0.078 ms
Execution Time: 0.098 ms  <-- 463x FASTER!
```

---

## 🧹 Rate Limit Cleanup with Cron

### Problem

**File:** `rate-limit.middleware.ts`

In-memory rate limit store grows indefinitely without cleanup, causing memory leak.

### Recommended Fix

**Install:**
```bash
pnpm add @nestjs/schedule
```

**Update rate-limit.middleware.ts:**
```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly rateLimitStore = new Map<string, RateLimitEntry>();

  // Clean up expired entries every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  cleanupExpiredEntries() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (entry.windowStart + entry.windowMs < now) {
        this.rateLimitStore.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[RateLimit] Cleaned up ${cleaned} expired entries. Current size: ${this.rateLimitStore.size}`);
    }
  }

  // Optional: Monitor memory usage
  @Cron(CronExpression.EVERY_HOUR)
  logMemoryUsage() {
    const usage = process.memoryUsage();
    console.log({
      rateLimitEntries: this.rateLimitStore.size,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    });
  }
}
```

**Enable in module:**
```typescript
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable cron jobs
  ],
})
export class AppModule {}
```

**Note:** This is a **temporary fix**. For production, use Redis-based rate limiting (see above).

---

## 💾 Session Storage Requirements

### Current Issue

**Files:**
- `csrf-protection.middleware.ts` (line 88)
- Bot handlers use session state

**Problem:**
- Session data stored in memory (default)
- Does NOT persist across server restarts
- Does NOT work in multi-instance deployments

### Recommended Fix: Redis Session Store

**Install:**
```bash
pnpm add express-session connect-redis ioredis
pnpm add -D @types/express-session
```

**Configure in main.ts:**
```typescript
import session from 'express-session';
import RedisStore from 'connect-redis';
import Redis from 'ioredis';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Redis client for sessions
  const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  });

  // Session middleware with Redis store
  app.use(
    session({
      store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
      secret: process.env.SESSION_SECRET || 'change-me-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax',
      },
    }),
  );

  await app.listen(3000);
}
```

**Environment variables:**
```bash
SESSION_SECRET=your-super-secret-session-key-change-this-in-production
NODE_ENV=production
```

### Security Considerations

1. **Generate strong session secret:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Rotate session secrets:**
   - Use multiple secrets for zero-downtime rotation
   ```typescript
   secret: [
     process.env.SESSION_SECRET_NEW,
     process.env.SESSION_SECRET_OLD,
   ],
   ```

3. **Configure cookie security:**
   ```typescript
   cookie: {
     secure: true,        // HTTPS only
     httpOnly: true,      // No JavaScript access
     sameSite: 'strict',  // CSRF protection
     domain: '.yourdomain.com', // Share across subdomains
   },
   ```

---

## 📊 Monitoring & Alerting

### Webhook Processing Failures

**Add to your monitoring system (Prometheus/Grafana):**

```typescript
import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly webhookCounter = new Counter({
    name: 'payment_webhooks_total',
    help: 'Total number of webhook requests',
    labelNames: ['status', 'type'],
  });

  private readonly webhookDuration = new Histogram({
    name: 'payment_webhook_duration_seconds',
    help: 'Webhook processing duration',
    labelNames: ['type'],
    buckets: [0.1, 0.5, 1, 2, 5],
  });

  recordWebhook(type: string, success: boolean) {
    this.webhookCounter.inc({
      status: success ? 'success' : 'failure',
      type,
    });
  }

  recordWebhookDuration(type: string, duration: number) {
    this.webhookDuration.observe({ type }, duration);
  }
}
```

**Alert rules (Prometheus):**
```yaml
groups:
  - name: payment_alerts
    rules:
      - alert: HighWebhookFailureRate
        expr: |
          rate(payment_webhooks_total{status="failure"}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High webhook failure rate detected"

      - alert: CriticalRollbackFailure
        expr: |
          increase(payment_rollback_failures_total[1m]) > 0
        for: 0m
        annotations:
          summary: "CRITICAL: Balance rollback failed - manual intervention required"
```

---

##Summary Checklist

### Before Production Deployment

- [ ] **Switch to Redis-based rate limiting**
  - Install ioredis and @nestjs/throttler
  - Configure RedisStore
  - Test across multiple instances

- [ ] **Add database indexes**
  - Run migration to add indexes
  - Verify performance improvement with EXPLAIN ANALYZE
  - Monitor index usage

- [ ] **Configure Redis session store**
  - Install connect-redis
  - Generate strong SESSION_SECRET
  - Configure cookie security

- [ ] **Add cron cleanup (if not using Redis)**
  - Install @nestjs/schedule
  - Add cleanup cron job
  - Monitor memory usage

- [ ] **Set up monitoring**
  - Webhook success/failure metrics
  - Rate limit metrics
  - Balance operation metrics
  - Critical error alerts

- [ ] **Load testing**
  - Test concurrent withdrawals (100+ simultaneous)
  - Test rate limiting effectiveness
  - Test webhook processing under load
  - Monitor database query performance

---

## Estimated Effort

| Task | Priority | Effort | Risk |
|------|----------|--------|------|
| Redis rate limiting | HIGH | 4 hours | Low |
| Database indexes | HIGH | 2 hours | Low |
| Redis sessions | MEDIUM | 3 hours | Low |
| Cron cleanup | LOW | 1 hour | Low |
| Monitoring setup | MEDIUM | 6 hours | Medium |
| Load testing | HIGH | 8 hours | Medium |

**Total:** ~24 hours (3 days)

---

## Additional Resources

- [NestJS Rate Limiting](https://docs.nestjs.com/security/rate-limiting)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/distributed-locks/)
- [PostgreSQL Indexing](https://www.postgresql.org/docs/current/indexes.html)
- [Session Security](https://owasp.org/www-community/controls/Session_Management_Cheat_Sheet)
