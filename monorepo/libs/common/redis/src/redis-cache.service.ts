import { Injectable } from '@nestjs/common';
import { InjectRedis } from './decorator';
import { RedisClient } from './type';

@Injectable()
export class RedisCacheService {
  constructor(
    @InjectRedis()
    private readonly redis: RedisClient,
  ) {}

  async withCache<T>(params: {
    action: () => Promise<T>;
    key: string;
    ttl: number; // seconds
    serialize: (value: Exclude<T, null | undefined>) => string;
    deserialize: (raw: string) => T;
    skip?: (value: T) => boolean;
  }): Promise<T> {
    const { action, key, ttl, serialize, deserialize, skip } = params;

    const value = await this.redis.get(key);

    if (typeof value === 'string') {
      return deserialize(value);
    } else {
      const result: T = await action();

      if (result === null || result === undefined) {
        return result;
      }

      if (skip?.(result)) {
        return result;
      }

      await this.redis.setex(key, ttl, serialize(result as Exclude<T, null | undefined>));

      return result;
    }
  }

  async setHash<T>(hashKey: string, values: Record<string, T>, ttl: number): Promise<void> {
    const pipeline = this.redis.pipeline();

    Object.entries(values).forEach(([field, value]) => {
      pipeline.hset(hashKey, field, JSON.stringify(value));
    });

    pipeline.expire(hashKey, ttl);
    await pipeline.exec();
  }

  async get(hashKey: string): Promise<string | null> {
    const result = await this.redis.get(hashKey);

    return result;
  }

  async getHash<T>(hashKey: string): Promise<Record<string, T>> {
    const result = await this.redis.hgetall(hashKey);

    return Object.entries(result).reduce(
      (acc, [field, value]) => ({
        ...acc,
        [field]: JSON.parse(value) as T,
      }),
      {} as Record<string, T>,
    );
  }

  async deleteFromHash(hashKey: string, field: string): Promise<void> {
    await this.redis.hdel(hashKey, field);
  }
}
