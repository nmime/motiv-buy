import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from '@app/common-health';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check application health status' })
  @ApiOkResponse({
    type: HealthResponseDto,
    description: 'Application health status retrieved successfully',
  })
  health(): HealthResponseDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Check if application is ready to serve traffic' })
  @ApiOkResponse({
    type: HealthResponseDto,
    description: 'Application readiness status retrieved successfully',
  })
  ready(): HealthResponseDto {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Check if application is alive' })
  @ApiOkResponse({
    type: HealthResponseDto,
    description: 'Application liveness status retrieved successfully',
  })
  live(): HealthResponseDto {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }
}
