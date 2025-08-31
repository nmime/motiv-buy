import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/feature-auth-main';
import { CurrentUser } from '@app/feature-auth-shared';
import {
  StatisticQueryDto,
  StatisticResponseDto,
} from '@app/feature-statistic-shared';
import { StatisticService } from '../service/statistic.service';

@ApiTags('statistic')
@Controller('statistic')
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
    @CurrentUser('id') userId: string,
  ): Promise<StatisticResponseDto> {
    return this.statisticService.getStatistic(userId, query);
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
  ): Promise<StatisticResponseDto> {
    return this.statisticService.getSharedStatistic(shareToken);
  }
}