import { Controller, Get, Query, UseGuards, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StatisticService } from '../service';
import { StatisticMapper } from '../mapper';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';
import { Ok } from 'ts-results';
import { JwtAuthGuard, CurrentUserId } from '@app/feature-auth-shared';
import {
  StatisticQueryDto,
  StatisticResponseDto,
  LineChartQueryDto,
  LineChartResponseDto,
  ShareTokenResponseDto,
} from '../dto';

@ApiTags('statistics')
@Controller('statistics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StatisticController {
  constructor(
    private readonly statisticService: StatisticService,
    private readonly statisticMapper: StatisticMapper,
  ) {}

  @Get('summary')
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({
    summary: 'Get resource-filtered statistics summary',
    description: `Get statistics filtered by resource ownership with proper security:

    **Resource Filtering (REQUIRED):**
    - \`type\`: Must specify statistic type (traffic_source, traffic_order, traffic_target, user)
    - \`sourceId\`: Filter traffic source stats by specific source ID (user must own source)
    - \`orderId\`: Filter traffic order stats by specific order ID (user must be creator)
    - \`targetId\`: Filter traffic target stats by specific target ID (user must own target)
    - \`userId\`: Filter user stats by specific user ID (defaults to current user)

    **Security:**
    - Traffic Sources: Only sources where managedBy = currentUserId
    - Traffic Orders: Only orders where creator = currentUserId
    - Traffic Targets: Only targets where managedBy = currentUserId
    - Users: Only current user's data (or admin access)

    **Date Filtering:**
    - \`fromDate\`: Start date (YYYY-MM-DD or ISO 8601)
    - \`endDate\`: End date (YYYY-MM-DD or ISO 8601)

    **Response Data:**
    - Resource-specific metrics with ownership validation
    - Share link for public access (7-day expiration)
    - Performance optimized with database-level aggregations`,
  })
  @ApiResponse({
    status: 200,
    description: 'Resource statistics retrieved successfully',
    type: StatisticResponseDto,
  })
  async getStatisticsSummary(
    @Query() query: StatisticQueryDto,
    @CurrentUserId() userId: string,
  ): AsyncResult<StatisticResponseDto, InternalException> {
    const serviceResult = await this.statisticService.getStatistics(userId, query);
    const mappedResult = this.statisticMapper.toStatisticResponse(serviceResult);

    return Ok(mappedResult);
  }

  @Get('chart')
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({
    summary: 'Get time-series chart data with resource filtering',
    description: `Get chart data filtered by resource ownership:

    **Required Parameters:**
    - \`type\`: Chart data type (traffic_source, traffic_order, traffic_target, user)
    - \`fromDate\`: Chart start date (YYYY-MM-DD or ISO 8601)
    - \`endDate\`: Chart end date (YYYY-MM-DD or ISO 8601)

    **Optional Parameters:**
    - \`interval\`: Data grouping interval (hour, day, week, month) - defaults to 'hour'

    **Resource Security:**
    - Only returns data for resources owned/managed by the current user
    - Efficient database queries with proper indexing
    - Chart data optimized for frontend visualization

    **Response:**
    - Time-series data points with date, count, and amount
    - Total aggregations across the period
    - Properly grouped by the specified interval`,
  })
  @ApiResponse({
    status: 200,
    description: 'Chart data retrieved successfully',
    type: LineChartResponseDto,
  })
  async getChartData(
    @Query() query: LineChartQueryDto,
    @CurrentUserId() userId: string,
  ): AsyncResult<LineChartResponseDto, InternalException> {
    const serviceResult = await this.statisticService.getLineChartData(userId, query);
    const mappedResult = this.statisticMapper.toLineChartResponse(serviceResult);

    return Ok(mappedResult);
  }

  @Post('share-token')
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({
    summary: 'Generate share token for public statistics access',
    description: `Generate a secure share token for public access to statistics:

    **Token Security:**
    - 7-day expiration from generation
    - Cryptographically secure with UUID randomness
    - Contains encoded user ID and statistic type
    - Cannot be used to access other users' data

    **Usage:**
    - Generated token can be used with public statistics endpoints
    - Share link provides direct browser access
    - Token format: {typeHash}-{userId}-{timestamp}-{uuid}

    **Access Control:**
    - Token only provides access to the specific user's data
    - No elevation of privileges through token sharing
    - Automatic expiration prevents long-term access`,
  })
  @ApiResponse({
    status: 200,
    description: 'Share token generated successfully',
    type: ShareTokenResponseDto,
  })
  generateShareToken(@Body() query: StatisticQueryDto, @CurrentUserId() userId: string): ShareTokenResponseDto {
    const shareToken = this.statisticService.generateShareToken(userId, query);

    return this.statisticMapper.toShareTokenResponse(shareToken);
  }
}
