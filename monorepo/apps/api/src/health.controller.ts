import { Controller } from '@nestjs/common';
import { BaseHealthController } from '@app/common-health';
import { DatabaseHealthIndicator } from '@app/database';
import { RedisHealthIndicator } from '@app/common-redis';

@Controller('health')
export class HealthController extends BaseHealthController {
  constructor(
    private readonly databaseHealthIndicator: DatabaseHealthIndicator,
    private readonly redisHealthIndicator: RedisHealthIndicator,
  ) {
    super([
      () => this.databaseHealthIndicator.pingCheck('database'),
      () => this.redisHealthIndicator.pingCheck('redis'),
    ]);
  }
}
