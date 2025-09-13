import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StatisticService } from '../service/statistic.service';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';
import { StatisticResponseDto } from '@app/feature-statistic-shared';

@ApiTags('statistics-public')
@Controller('statistics-public')
export class StatisticPublicController {
  constructor(private readonly statisticService: StatisticService) {}

  @Get(':shareToken')
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({
    summary: 'Get shared statistics',
    description: `Get statistics by share token (public access, no authentication required).
    
    Share tokens are generated when requesting statistics and allow public access to specific statistical data.
    Each token contains encoded information about the statistic type and filters used.
    
    **Supported Statistics:**
    - Traffic source statistics (actions, rewards, performance)
    - Traffic order statistics (completion, budgets, spending)
    - Traffic target statistics (targets, orders, pricing)
    - User statistics (activity, transactions, balance changes)
    
    **Security:** 
    - No sensitive user data is exposed
    - Tokens have limited lifetime
    - Only aggregated statistical data is returned`,
  })
  @ApiResponse({
    status: 200,
    description: 'Shared statistics retrieved successfully',
    type: StatisticResponseDto,
  })
  async getSharedStatistics(
    @Param('shareToken') shareToken: string,
  ): AsyncResult<StatisticResponseDto, InternalException> {
    const result = await this.statisticService.getSharedStatistic(shareToken);
    return { success: true, data: result };
  }
}
