import { Global, Module, Scope } from '@nestjs/common';
import IORedis, { Cluster } from 'ioredis';
import { RedisConfigModule, RedisConfigService } from './config';
import { RedisInjectToken, RedisInjectTransientToken, RedisMode } from './const';
import { RedisHealthIndicator } from './redis.health';
import { RedisCacheService } from './redis-cache.service';
import { RedisRateLimitService } from './redis-rate-limit.service';
import Redlock from 'redlock';
import { TerminusModule } from '@nestjs/terminus';

const redisFactory = ({ config }: RedisConfigService) => {
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
    return new IORedis({
      sentinels: config.hosts,
      name: config.sentinelGroupIdentifier,
      password: config.password,
      db: config.db,
      autoResubscribe: true,
    });
  }

  return new IORedis({
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
      useFactory: (redis: IORedis | Cluster) => {
        return new Redlock([redis], {
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
