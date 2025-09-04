import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StatisticService } from '../service/statistic.service';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';
import { JwtAuthGuard, CurrentUserId } from '@app/feature-auth-shared';
import { StatisticQueryDto, StatisticResponseDto, StatisticTokenDto } from '../dto';

@ApiTags('statistic')
@Controller('statistic')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StatisticController {
  constructor(private readonly statisticService: StatisticService) {}

  @Get()
  @ApiProblemExceptions([
    [InternalException, { description: 'Internal server error occurred' }],
  ])
  @ApiOperation({
    summary: 'Get traffic statistic',
    description: `Get statistic with optional filtering:
    - Filter by type (sale/purchase)  
    - Filter by specific order ID
    - Filter by date range
    - Returns people count and money amount`,
  })
  @ApiResponse({
    status: 200,
    description: 'Statistic retrieved successfully',
  })
  async getStatistic(
    @Query() query: StatisticQueryDto,
    @CurrentUserId() userId: string,
  ): AsyncResult<StatisticResponseDto, InternalException> {
    const result = await this.statisticService.getStatistic(userId, query);
    return { success: true, data: result };
  }

  @Get('token')
  @ApiProblemExceptions([
    [InternalException, { description: 'Internal server error occurred' }],
  ])
  @ApiOperation({
    summary: 'Get share token for statistics',
    description: 'Generate a share token for public access to statistics',
  })
  @ApiResponse({
    status: 200,
    description: 'Share token generated successfully',
  })
  async getStatisticToken(
    @CurrentUserId() userId: string,
  ): AsyncResult<StatisticTokenDto, InternalException> {
    const result = await this.statisticService.generateShareToken(userId);
    return { success: true, data: result };
  }
}