import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUserId, JwtAuthGuard } from '@app/feature-auth-shared';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { ClientDataProblemValidationException } from '@app/common-validation';
import { AsyncResult } from '@app/common-shared';
import { Ok } from 'ts-results';
import { TrafficOrderResponseDto } from '@app/feature-traffic-shared';
import { TrafficService } from '../service/traffic.service';

/**
 * Traffic Target Controller
 * Handles traffic target operations - managing channels/groups that receive traffic
 */
@ApiTags('Traffic Targets')
@Controller('traffic/targets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiProblemExceptions([
  [InternalException, { description: 'Internal server error occurred' }],
  [ClientDataProblemValidationException, { description: 'Request validation failed' }],
])
export class TrafficTargetController {
  constructor(private readonly trafficService: TrafficService) {}

  @Get()
  @ApiOperation({
    summary: 'Get user traffic orders',
    description: 'Retrieve all traffic orders which include target information',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by order status',
    enum: ['pending', 'active', 'completed', 'cancelled'],
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of orders to return',
    type: Number,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of orders to skip',
    type: Number,
  })
  @ApiOkResponse({
    description: 'User traffic orders retrieved successfully',
    type: [TrafficOrderResponseDto],
  })
  async getUserTrafficOrders(@CurrentUserId() userId: string): Promise<AsyncResult<TrafficOrderResponseDto[], Error>> {
    const result = await this.trafficService.getUserTrafficOrders(userId);

    return Ok(result);
  }

  @Get(':targetId')
  @ApiOperation({
    summary: 'Get traffic order details',
    description: 'Retrieve detailed information about a specific traffic order',
  })
  @ApiParam({
    name: 'targetId',
    description: 'Traffic order/target ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Traffic order details retrieved successfully',
    type: TrafficOrderResponseDto,
  })
  async getTrafficOrder(
    @Param('targetId') targetId: string,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<TrafficOrderResponseDto, Error>> {
    const result = await this.trafficService.getTrafficOrder(targetId, userId);

    return Ok(result);
  }
}
