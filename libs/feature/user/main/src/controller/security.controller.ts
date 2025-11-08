import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId, JwtAuthGuard } from '@app/feature-auth-shared';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';
import { Ok } from 'ts-results';
import { LoginHistoryResponseDto, SecurityOverviewResponseDto } from '../dto';
import { SecurityService } from '../service';

/**
 * Security Controller
 * Manages security-related features including login history and security overview
 */
@ApiTags('security')
@Controller('security')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('login-history')
  @ApiOperation({ summary: 'Get login history' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of records (default: 50, max: 100)' })
  @ApiResponse({ status: 200, description: 'Login history retrieved successfully', type: [LoginHistoryResponseDto] })
  async getLoginHistory(
    @CurrentUserId() userId: string,
    @Query('limit') limit?: number,
  ): AsyncResult<LoginHistoryResponseDto[], InternalException> {
    const resultLimit = Math.min(Math.max(limit ?? 50, 1), 100);
    const result = await this.securityService.getLoginHistory(userId, resultLimit);

    return Ok(result);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get security overview' })
  @ApiResponse({
    status: 200,
    description: 'Security overview retrieved successfully',
    type: SecurityOverviewResponseDto,
  })
  async getSecurityOverview(
    @CurrentUserId() userId: string,
  ): AsyncResult<SecurityOverviewResponseDto, InternalException> {
    const result = await this.securityService.getSecurityOverview(userId);

    return Ok(result);
  }
}
