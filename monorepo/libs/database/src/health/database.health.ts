import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { DatabaseService } from '../service/database.service';

/**
 * Database health indicator for NestJS Terminus
 */
@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  /**
   * Ping check for database connectivity
   */
  async pingCheck(key = 'database'): Promise<HealthIndicatorResult> {
    try {
      const healthResult = await this.databaseService.healthCheck();
      
      const isHealthy = healthResult.status === 'healthy' && healthResult.connected;
      
      if (isHealthy) {
        return this.healthIndicatorService.check(key, () => ({
          status: 'up',
          connected: healthResult.connected,
          uptime: healthResult.uptime,
          type: healthResult.type,
        }));
      } else {
        throw new Error('Database connection failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Database connection failed';
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Check if database can execute queries
   */
  async queryCheck(key = 'database_query'): Promise<HealthIndicatorResult> {
    try {
      const orm = this.databaseService.getORM();
      const em = orm.em;
      
      // Simple query to test database functionality
      await em.getConnection().execute('SELECT 1 as test');
      
      return this.healthIndicatorService.check(key, () => ({
        status: 'up',
        message: 'Database queries working',
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Database query failed';
      
      throw new Error(errorMessage);
    }
  }
}