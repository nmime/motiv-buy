import { Injectable } from '@nestjs/common';
import { InjectRedis } from './decorator';
import { RedisClient } from './type';
import { Err, Result } from 'ts-results';
import { AsyncResult, unknownToError } from '@app/common-shared';
import { InternalException, RateLimitExceedException } from '@app/common-exception';

/**
 * This service utilizes a Fixed Window strategy to rate limiting
 */
@Injectable()
export class RedisRateLimitService {
  constructor(
    @InjectRedis()
    private readonly redis: RedisClient,
  ) {}

  async using<OkType, ErrorType = never>(options: {
    resource: string;
    ttl: number; // milliseconds
    limit: number;
    action: () => AsyncResult<OkType, ErrorType> | Result<OkType, ErrorType>;
  }): AsyncResult<OkType, ErrorType | RateLimitExceedException | InternalException> {
    const { resource, ttl, limit, action } = options;

    const key = `rate-limit:${resource}`;

    try {
      const luaScript = `
        redis.call('set', KEYS[1], 0, 'PX', ARGV[1], 'NX')
        return redis.call('incr', KEYS[1])
      `;

      const result = await this.redis.eval(luaScript, 1, key, ttl.toString());

      if (typeof result !== 'number') {
        return Err(new InternalException({ detail: 'Error on executing rate limit' }));
      }

      if (result > limit) {
        return Err(new RateLimitExceedException({ detail: 'Rate limit exceeded' }));
      }

      return await action();
    } catch (error: unknown) {
      return Err(new InternalException({ detail: 'Error on executing rate limit', cause: unknownToError(error) }));
    }
  }

  async slidingWindowCounter<OkType, ErrorType = never>(options: {
    resource: string;
    limit: number;
    windowSize?: number; // seconds, default 60 seconds
    action: () => AsyncResult<OkType, ErrorType> | Result<OkType, ErrorType>;
  }): AsyncResult<OkType, ErrorType | RateLimitExceedException | InternalException> {
    const { resource, limit, action } = options;

    const windowSize = options.windowSize ?? 60; // 60 seconds by default

    const key = `sliding-rate-limit:v2:${resource}`;

    try {
      const currentTime = Math.floor(Date.now() / 1000);
      const windowStart = currentTime - windowSize;

      const luaScript = `
        local key = KEYS[1]
        local windowStart = tonumber(ARGV[1])
        local currentTime = tonumber(ARGV[2])
        local limit = tonumber(ARGV[3])
        local windowSize = tonumber(ARGV[4])
        
        redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)
        
        local count = redis.call('ZCARD', key)
        if count >= limit then
          return count
        end
        
        redis.call('ZADD', key, currentTime, currentTime .. ':' .. math.random())
        redis.call('EXPIRE', key, windowSize)
        
        return count + 1
      `;

      const count = await this.redis.eval(
        luaScript,
        1,
        key,
        windowStart.toString(),
        currentTime.toString(),
        limit.toString(),
        windowSize.toString(),
      );

      if (typeof count !== 'number') {
        return Err(new InternalException({ message: 'Error on executing sliding window rate limit' }));
      }

      if (count > limit) {
        return Err(new RateLimitExceedException({ message: 'Rate limit exceeded' }));
      }

      return await action();
    } catch (error: unknown) {
      return Err(
        new InternalException({
          message: 'Error on executing sliding window rate limit',
          cause: unknownToError(error),
        }),
      );
    }
  }
}
