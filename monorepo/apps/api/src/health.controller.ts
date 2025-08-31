import { Controller } from '@nestjs/common';
import { HealthIndicatorResult } from '@nestjs/terminus';
import { BaseHealthController } from '@app/common-health';
import { DatabaseHealthIndicator } from '@app/database';
import { RedisHealthIndicator } from '@app/common-redis';

/**
 * API Health Controller
 * 
 * Extends BaseHealthController with database and Redis health checks
 */
@Controller('health')
export class HealthController extends BaseHealthController {
  
  constructor(
    private readonly databaseHealthIndicator: DatabaseHealthIndicator,
    private readonly redisHealthIndicator: RedisHealthIndicator,
  ) {
    // Pass health checks to the base controller
    super(
      undefined, // health service (deprecated)
      undefined, // shutdown service (deprecated) 
      [
        () => this.databaseHealthIndicator.pingCheck('database'),
        () => this.redisHealthIndicator.pingCheck('redis'),
      ]
    );
  }
}
