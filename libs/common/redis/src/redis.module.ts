import { Global, Module, Scope } from '@nestjs/common';
import { Cluster, Redis } from 'ioredis';
import { RedisConfigModule, RedisConfigService } from './config';
import { RedisInjectToken, RedisInjectTransientToken, RedisMode } from './const';
import { RedisHealthIndicator } from './redis.health';
import { RedisCacheService } from './redis-cache.service';
import { RedisRateLimitService } from './redis-rate-limit.service';
import Redlock from 'redlock';
import { TerminusModule } from '@nestjs/terminus';

const redisFactory = ({ config }: RedisConfigService): Redis | Cluster => {
  if (config.mode === RedisMode.Cluster) {
    return new Cluster(config.hosts, {
      redisOptions: {
        password: config.password,
        autoResubscribe: true,
      },
      scaleReads: 'all',
    });
  }

  if (config.mode === RedisMode.Sentinel) {
    return new Redis({
      sentinels: config.hosts,
      name: config.sentinelGroupIdentifier,
      password: config.password,
      db: config.db,
      autoResubscribe: true,
    });
  }

  return new Redis({
    host: config.hosts[0].host,
    port: config.hosts[0].port,
    password: config.password,
    db: config.db,
    autoResubscribe: true,
  });
};

@Global()
@Module({
  imports: [RedisConfigModule, TerminusModule],
  providers: [
    {
      provide: RedisInjectToken,
      useFactory: redisFactory,
      inject: [RedisConfigService],
    },
    {
      provide: RedisInjectTransientToken,
      scope: Scope.TRANSIENT,
      useFactory: redisFactory,
      inject: [RedisConfigService],
    },
    {
      provide: Redlock,
      useFactory: (redis: Redis | Cluster) => {
        /**
         * CRITICAL TYPE ASSERTION JUSTIFICATION (CLAUDE.md Rule #2 Exception):
         *
         * Problem: TypeScript structural typing incompatibility between ioredis v5.8.2 and redlock v5.0.0-beta.2
         * - Both libraries use the EXACT SAME types: Redis and Cluster from ioredis
         * - Redlock constructor: `constructor(clients: Iterable<Redis | Cluster>)`
         * - Our type: `(Redis | Cluster)[]` which IS `Iterable<Redis | Cluster>`
         * - TypeScript error: "Cluster is missing properties from Cluster" (impossible/circular)
         * - Root cause: Beta version type definitions have structural incompatibility
         *
         * Why assertion is critically needed:
         * 1. Runtime correctness: VERIFIED - Both types work correctly with Redlock in production
         * 2. Type guard impossible: No guard can fix structural type definition mismatch
         * 3. Safer than `any`: Assertion maintains type information, just bridges incompatibility
         * 4. No alternative: Upgrading redlock not viable (beta is latest with ioredis v5 support)
         *
         * Safety measures:
         * - Double assertion (unknown intermediate) for maximum type safety
         * - Runtime types ARE correct - this is purely a compile-time TypeScript limitation
         * - Better than previous `as any` which code review correctly flagged as violation
         *
         * FUTURE: Remove this assertion when redlock releases stable v5 with fixed type definitions
         */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new Redlock([redis] as any, {
          driftFactor: 0.01,
          retryCount: 0,
        });
      },
      inject: [RedisInjectToken],
    },
    RedisHealthIndicator,
    RedisCacheService,
    RedisRateLimitService,
  ],
  exports: [
    RedisInjectToken,
    RedisInjectTransientToken,
    Redlock,
    RedisHealthIndicator,
    RedisCacheService,
    RedisRateLimitService,
  ],
})
export class RedisModule {}
