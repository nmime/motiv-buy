import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StatisticService } from '../service/statistic.service';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';
import { JwtAuthGuard, CurrentUserId } from '@app/feature-auth-shared';
import { 
  StatisticQueryDto, 
  StatisticResponseDto,
  LineChartQueryDto,
  LineChartResponseDto 
} from '@app/feature-statistic-shared';

@ApiTags('statistics')
@Controller('statistics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StatisticController {
  constructor(private readonly statisticService: StatisticService) {}

  @Get()
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({
    summary: 'Get period statistics',
    description: `Get overall statistics for a specific period with comprehensive filtering options:
    
    **Statistic Types (Required):**
    - \`traffic_source\`: Statistics about traffic sources (bots, actions, rewards)
    - \`traffic_order\`: Statistics about traffic orders (completed, pending, budgets)
    - \`traffic_target\`: Statistics about traffic targets (channels, groups, earnings)
    - \`user\`: Statistics about users (active users, transactions, balance changes)
    
    **Filtering Options:**
    - \`fromDate\`: Start date for filtering (YYYY-MM-DD or ISO 8601)
    - \`endDate\`: End date for filtering (YYYY-MM-DD or ISO 8601)
    - \`orderId\`: Filter by specific order ID
    - \`sourceId\`: Filter by specific traffic source ID
    - \`targetId\`: Filter by specific traffic target ID
    - \`userId\`: Filter by specific user ID (for user statistics)
    
    **Response Data:**
    - \`countOfActions\`: Total number of actions/entities in the period
    - \`amountEarnedOrSpent\`: Total money earned (positive) or spent (negative)
    - Type-specific additional metrics (unique counts, averages, etc.)
    - Shareable public link for the statistics
    
    **Use Cases:**
    - Dashboard summary cards
    - Period performance overview  
    - KPI monitoring
    - Public sharing via generated links`,
  })
  @ApiResponse({
    status: 200,
    description: 'Period statistics retrieved successfully',
    type: StatisticResponseDto,
  })
  async getStatistics(
    @Query() query: StatisticQueryDto,
    @CurrentUserId() userId: string,
  ): AsyncResult<StatisticResponseDto, InternalException> {
    const result = await this.statisticService.getStatistics(userId, query);
    return { success: true, data: result };
  }

  @Get('chart')
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({
    summary: 'Get line chart data',
    description: `Get time-series data for line charts with configurable intervals:
    
    **Chart Types (Required):**
    - \`traffic_source\`: Time-series data for traffic source actions and rewards
    - \`traffic_order\`: Time-series data for order creation and spending
    - \`traffic_target\`: Time-series data for target activity and earnings
    - \`user\`: Time-series data for user transactions and balance changes
    
    **Required Parameters:**
    - \`type\`: Chart data type (see above)
    - \`fromDate\`: Chart start date (YYYY-MM-DD or ISO 8601)
    - \`endDate\`: Chart end date (YYYY-MM-DD or ISO 8601)
    
    **Optional Parameters:**
    - \`interval\`: Data grouping interval (hour, day, week, month) - defaults to 'hour' (minimum interval)
    
    **Response Data:**
    - \`dataPoints\`: Array of time-series data points with date, count, and amount
    - \`totalActions\`: Sum of all actions across the entire period
    - \`totalAmount\`: Sum of all amounts across the entire period
    - \`interval\`: The interval used for data grouping
    
    **Use Cases:**
    - Line charts and trend visualizations
    - Performance tracking over time
    - Growth analysis and forecasting
    - Historical data comparison`,
  })
  @ApiResponse({
    status: 200,
    description: 'Line chart data retrieved successfully',
    type: LineChartResponseDto,
  })
  async getLineChartData(
    @Query() query: LineChartQueryDto,
    @CurrentUserId() userId: string,
  ): AsyncResult<LineChartResponseDto, InternalException> {
    const result = await this.statisticService.getLineChartData(userId, query);
    return { success: true, data: result };
  }
}
