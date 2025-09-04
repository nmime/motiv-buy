import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StatisticService } from '../service/statistic.service';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';
import { StatisticResponseDto } from '../dto';

@ApiTags('statistic-public')
@Controller('statistic-public')
export class StatisticPublicController {
  constructor(private readonly statisticService: StatisticService) {}

  @Get(':shareToken')
  @ApiProblemExceptions([
    [InternalException, { description: 'Internal server error occurred' }],
  ])
  @ApiOperation({
    summary: 'Get shared statistic',
    description: 'Get statistic by share token (public access, no auth required)',
  })
  @ApiResponse({
    status: 200,
    description: 'Shared statistic retrieved successfully',
  })
  async getSharedStatistic(
    @Param('shareToken') shareToken: string,
  ): AsyncResult<StatisticResponseDto, InternalException> {
    const result = await this.statisticService.getSharedStatistic(shareToken);
    return { success: true, data: result };
  }
}