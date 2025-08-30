import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheckResponse } from '@app/shared-types';

/**
 * Health Check Controller
 * 
 * Provides health and status endpoints for monitoring
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is healthy',
    type: HealthCheckResponse
  })
  check(): HealthCheckResponse {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: 'up', // This should check actual database connection
      },
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe endpoint' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  ready(): { status: string } {
    return { status: 'ready' };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe endpoint' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  live(): { status: string } {
    return { status: 'alive' };
  }
}
