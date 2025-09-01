import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUserId, UnauthorizedException } from '@app/feature-auth-shared';
import {
  StatisticQueryDto,
  StatisticResponseDto,
} from '@app/feature-statistic-shared';
import { StatisticService } from '../service/statistic.service';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';

@ApiTags('statistic')
@Controller('statistic')
@ApiProblemExceptions([
  [UnauthorizedException, { description: 'User not authenticated' }],
  [InternalException, { description: 'Internal server error occurred' }],
])
export class StatisticController {
  constructor(private readonly statisticService: StatisticService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get traffic statistic',
    description: `Get statistic with optional filtering:
    - Filter by type (sale/purchase)  
    - Filter by specific order ID
    - Filter by date range
    - Returns people count and money amount
    - Includes shareable link`,
  })
  @ApiResponse({
    status: 200,
    description: 'Statistic retrieved successfully',
    type: StatisticResponseDto,
  })
  async getStatistic(
    @Query() query: StatisticQueryDto,
    @CurrentUserId() userId: string,
  ): AsyncResult<StatisticResponseDto, UnauthorizedException | InternalException> {
    const result = await this.statisticService.getStatistic(userId, query);
    return { success: true, data: result };
  }

  @Get('shared/:shareToken')
  @ApiOperation({
    summary: 'Get shared statistic',
    description: 'Get statistic by share token (public access, no auth required)',
  })
  @ApiResponse({
    status: 200,
    description: 'Shared statistic retrieved successfully',
    type: StatisticResponseDto,
  })
  async getSharedStatistic(
    @Param('shareToken') shareToken: string,
  ): AsyncResult<StatisticResponseDto, InternalException> {
    const result = await this.statisticService.getSharedStatistic(shareToken);
    return { success: true, data: result };
  }
}