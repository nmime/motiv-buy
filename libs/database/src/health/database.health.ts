import { unknownToError } from '@app/common-shared';
import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult } from '@nestjs/terminus';
import { DatabaseService } from '../service/database.service';

/**
 * Database health indicator for NestJS Terminus
 */
@Injectable()
export class DatabaseHealthIndicator {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Ping check for database connectivity
   */
  async pingCheck(key = 'database'): Promise<HealthIndicatorResult> {
    try {
      const healthResult = await this.databaseService.healthCheck();

      const isHealthy = healthResult.status === 'healthy' && healthResult.connected;

      if (isHealthy) {
        return {
          [key]: {
            status: 'up',
            connected: healthResult.connected,
            uptime: healthResult.uptime,
            type: healthResult.type,
          },
        };
      } else {
        throw new Error('Database connection failed');
      }
    } catch (error: unknown) {
      const errorMessage = unknownToError(error);

      throw new Error(errorMessage);
    }
  }

  /**
   * Check if database can execute queries
   */
  async queryCheck(key = 'database_query'): Promise<HealthIndicatorResult> {
    try {
      const orm = this.databaseService.getORM();
      const { em } = orm;

      // Simple query to test database functionality
      await em.getConnection().execute('SELECT 1 as test');

      return {
        [key]: {
          status: 'up',
          message: 'Database queries working',
        },
      };
    } catch (error: unknown) {
      const errorMessage = unknownToError(error);

      throw new Error(errorMessage);
    }
  }
}
