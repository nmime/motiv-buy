import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { Injectable } from '@nestjs/common';
import { RedisClient } from './type';
import { InjectRedis } from './decorator';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @InjectRedis() protected readonly redis: RedisClient,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async pingCheck(key = 'redis'): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const result = await this.redis.ping();

      return result === 'PONG' ? indicator.up() : indicator.down();
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(`Unknown error: ${JSON.stringify(e)}`);

      return indicator.down({ message: error.message });
    }
  }
}
