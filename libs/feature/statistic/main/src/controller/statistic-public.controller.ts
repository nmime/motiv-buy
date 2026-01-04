import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StatisticService } from '../service';
import { StatisticMapper } from '../mapper';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';
import { Ok } from 'ts-results';
import { LineChartQueryDto, LineChartResponseDto, StatisticResponseDto } from '../dto';

@ApiTags('public-statistics')
@Controller('public/statistics')
export class StatisticPublicController {
  constructor(
    private readonly statisticService: StatisticService,
    private readonly statisticMapper: StatisticMapper,
  ) {}

  @Get('summary/:shareToken')
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({
    summary: 'Get public statistics summary using share token',
    description: `Get statistics using a valid share token for public access:

    **Share Token Security:**
    - 7-day expiration from generation time
    - Cryptographically secure format: {typeHash}-{userId}-{timestamp}-{uuid}
    - Cannot access other users' data beyond what token allows
    - Automatic validation prevents expired or malformed tokens

    **Response Data:**
    - Resource-specific metrics based on token's encoded type
    - Performance optimized with database-level aggregations
    - No sensitive user information exposed
    - Same statistical data as private endpoints but publicly accessible

    **Token Format Examples:**
    - Traffic Source: tra-user123-1704067200000-abc123def456
    - Traffic Order: ord-user123-1704067200000-def789ghi012
    - Traffic Target: tar-user123-1704067200000-ghi345jkl678
    - User Stats: use-user123-1704067200000-jkl901mno234`,
  })
  @ApiParam({
    name: 'shareToken',
    description: 'Valid share token for public statistics access',
    example: 'tra-user123-1704067200000-abc123def456',
  })
  @ApiResponse({
    status: 200,
    description: 'Public statistics retrieved successfully',
    type: StatisticResponseDto,
  })
  async getPublicStatisticsSummary(
    @Param('shareToken') shareToken: string,
  ): AsyncResult<StatisticResponseDto, InternalException> {
    const serviceResult = await this.statisticService.getSharedStatistic(shareToken);
    const mappedResult = this.statisticMapper.toStatisticResponse(serviceResult);

    return Ok(mappedResult);
  }

  @Get('chart/:shareToken')
  @ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
  @ApiOperation({
    summary: 'Get public chart data using share token',
    description: `Get time-series chart data using a valid share token:

    **Required Parameters:**
    - \`shareToken\`: Valid share token (URL parameter)
    - \`fromDate\`: Chart start date (YYYY-MM-DD or ISO 8601)
    - \`endDate\`: Chart end date (YYYY-MM-DD or ISO 8601)

    **Optional Parameters:**
    - \`interval\`: Data grouping interval (hour, day, week, month) - defaults to 'hour'

    **Token Security:**
    - Same security model as summary endpoint
    - 7-day expiration validation
    - Resource type determined from token content
    - No cross-user data access possible

    **Response:**
    - Time-series data points with date, count, and amount
    - Total aggregations across the specified period
    - Properly grouped by the specified interval
    - Chart data optimized for frontend visualization

    **Performance:**
    - Database-level aggregations for efficiency
    - Proper indexing utilized for fast queries
    - Limited result sets to prevent overload`,
  })
  @ApiParam({
    name: 'shareToken',
    description: 'Valid share token for public chart data access',
    example: 'tra-user123-1704067200000-abc123def456',
  })
  @ApiResponse({
    status: 200,
    description: 'Public chart data retrieved successfully',
    type: LineChartResponseDto,
  })
  async getPublicChartData(
    @Param('shareToken') shareToken: string,
    @Query() query: LineChartQueryDto,
  ): AsyncResult<LineChartResponseDto, InternalException> {
    const serviceResult = await this.statisticService.getSharedLineChartData(shareToken, query);
    const mappedResult = this.statisticMapper.toLineChartResponse(serviceResult);

    return Ok(mappedResult);
  }
}
