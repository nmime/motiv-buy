import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUserId, JwtAuthGuard } from '@app/feature-auth-shared';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { ClientDataProblemValidationException } from '@app/common-validation';
import { AsyncResult } from '@app/common-shared';
import { Ok } from 'ts-results';
import {
  CreateTrafficOrderDto,
  TrafficOrderDto,
  TrafficOrderResponseDto,
  UpdateTrafficOrderDto,
} from '@app/feature-traffic-shared';
import { TrafficService } from '../service/traffic.service';

/**
 * Traffic Order Controller
 * Handles traffic purchase operations - creating and managing traffic orders
 */
@ApiTags('Traffic Orders')
@Controller('traffic/orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiProblemExceptions([
  [InternalException, { description: 'Internal server error occurred' }],
  [ClientDataProblemValidationException, { description: 'Request validation failed' }],
])
export class TrafficOrderController {
  constructor(private readonly trafficService: TrafficService) {}

  @Post()
  @ApiOperation({
    summary: 'Create traffic order',
    description: 'Create a new traffic order with automatic target creation',
  })
  @ApiOkResponse({
    description: 'Traffic order created successfully',
    type: TrafficOrderDto,
  })
  async createTrafficOrder(
    @Body() dto: CreateTrafficOrderDto,
    @CurrentUserId() userId: string,
  ): AsyncResult<TrafficOrderResponseDto, Error> {
    const result = await this.trafficService.createTrafficOrder(dto, userId);

    return Ok(result);
  }

  @Get()
  @ApiOperation({
    summary: 'Get user traffic orders',
    description: 'Retrieve all traffic orders for the current user',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by order status',
    enum: ['pending', 'active', 'completed', 'cancelled', 'failed'],
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
    type: [TrafficOrderDto],
  })
  async getUserTrafficOrders(@CurrentUserId() userId: string): AsyncResult<TrafficOrderResponseDto[], Error> {
    const result = await this.trafficService.getUserTrafficOrders(userId);

    return Ok(result);
  }

  @Get(':orderId')
  @ApiOperation({
    summary: 'Get traffic order details',
    description: 'Retrieve detailed information about a specific traffic order',
  })
  @ApiParam({
    name: 'orderId',
    description: 'Traffic order ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Traffic order details retrieved successfully',
    type: TrafficOrderDto,
  })
  async getTrafficOrder(
    @Param('orderId') orderId: string,
    @CurrentUserId() userId: string,
  ): AsyncResult<TrafficOrderResponseDto, Error> {
    const result = await this.trafficService.getTrafficOrder(orderId, userId);

    return Ok(result);
  }

  @Patch(':orderId')
  @ApiOperation({
    summary: 'Update traffic order',
    description: 'Update traffic order settings and configuration',
  })
  @ApiParam({
    name: 'orderId',
    description: 'Traffic order ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Traffic order updated successfully',
    type: TrafficOrderDto,
  })
  async updateTrafficOrder(
    @Param('orderId') orderId: string,
    @Body() dto: UpdateTrafficOrderDto,
    @CurrentUserId() userId: string,
  ): AsyncResult<TrafficOrderResponseDto, Error> {
    const result = await this.trafficService.updateTrafficOrder(orderId, dto, userId);

    return Ok(result);
  }

  @Delete(':orderId')
  @ApiOperation({
    summary: 'Cancel traffic order',
    description: 'Cancel an active traffic order and process refund if applicable',
  })
  @ApiParam({
    name: 'orderId',
    description: 'Traffic order ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Traffic order cancelled successfully',
  })
  async cancelTrafficOrder(
    @Param('orderId') orderId: string,
    @CurrentUserId() userId: string,
  ): AsyncResult<{ message: string }, Error> {
    const result = await this.trafficService.cancelTrafficOrder(orderId, userId);

    return Ok(result);
  }
}
