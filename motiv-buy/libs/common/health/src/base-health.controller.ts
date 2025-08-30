import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheckResult, HealthCheckService, HealthIndicatorResult } from '@nestjs/terminus';
import { ShutdownService } from './shutdown.service';
import { Health } from './decorator';
import { HealthCheckStatus } from '@nestjs/terminus/dist/health-check/health-check-result.interface';

@ApiTags('health')
@Controller('health')
export abstract class BaseHealthController {
  @Inject(HealthCheckService)
  protected readonly healthService!: HealthCheckService;

  protected constructor(
    /** @deprecated */
    health?: HealthCheckService,
    /** @deprecated */
    protected readonly shutdownService?: ShutdownService,
    /** @deprecated use override of readiness */
    private readonly checks?: (() => Promise<HealthIndicatorResult> | HealthIndicatorResult)[],
  ) {}

  @Get('/liveness')
  @Health({
    summary: 'Liveness check',
  })
  async liveness(): Promise<HealthCheckResult> {
    return await this.healthService.check([]);
  }

  @Get('/readiness')
  @Health({
    summary: 'Readiness check',
  })
  async readiness(): Promise<HealthCheckResult> {
    // eslint-disable-next-line sonarjs/deprecation
    return await this.healthService.check(this.checks ?? []);
  }

  @Get('/business')
  @Health({
    summary: 'Business check',
  })
  async business(): Promise<HealthCheckResult> {
    return await this.healthService.check([]);
  }

  @Get('/external')
  @Health({
    summary: 'External check',
  })
  async external(): Promise<HealthCheckResult> {
    return await this.healthService.check([]);
  }

  @Get('/')
  @Health({
    summary: 'Health check',
    public: true,
    swagger: true,
  })
  async health(): Promise<HealthCheckResult> {
    const status: HealthCheckStatus = Object.values((await this.readiness()).details).every(
      (detail) => detail.status === 'up',
    )
      ? 'ok'
      : 'error';

    return {
      status,
      info: undefined,
      error: undefined,
      details: undefined,
    } as unknown as HealthCheckResult;
  }
}
