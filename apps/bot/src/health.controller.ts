import { Controller } from '@nestjs/common';
import { BaseHealthController } from '@app/common-health';
import { DatabaseHealthIndicator } from '@app/database';
import { RedisHealthIndicator } from '@app/common-redis';

@Controller('health')
export class HealthController extends BaseHealthController {
  constructor(
    private readonly databaseHealth: DatabaseHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
  ) {
    super([() => databaseHealth.pingCheck('database'), () => redisHealth.pingCheck('redis')]);
  }
}
