import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUserId } from '@app/feature-auth-shared';
import { ApiProblemExceptions } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';
import {
  CreateTrafficOrderDto,
  TrafficOrderDto,
  UpdateTrafficOrderDto,
  TrafficOrderStatusDto,
  TrafficOrderStatsDto,
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
@ApiProblemExceptions([])
export class TrafficOrderController {
  constructor(private readonly trafficService: TrafficService) {}

  /**
   * Create a new traffic order
   * Creates both traffic target and order in a single transaction
   */
  @Post()
  @ApiOperation({
    summary: 'Create traffic order',
    description: 'Create a new traffic order with automatic target creation',
  })
  @ApiResponse({
    status: 201,
    description: 'Traffic order created successfully',
    type: TrafficOrderDto,
  })
  async createTrafficOrder(
    @Body() dto: CreateTrafficOrderDto,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<TrafficOrderDto, Error>> {
    return this.trafficService.createTrafficOrder(dto, userId);
  }

  /**
   * Get user's traffic orders
   */
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
  @ApiResponse({
    status: 200,
    description: 'User traffic orders retrieved successfully',
    type: [TrafficOrderDto],
  })
  async getUserTrafficOrders(
    @CurrentUserId() userId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<AsyncResult<TrafficOrderDto[], Error>> {
    return this.trafficService.getUserTrafficOrders(userId, {
      status,
      limit,
      offset,
    });
  }

  /**
   * Get specific traffic order details
   */
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
  @ApiResponse({
    status: 200,
    description: 'Traffic order details retrieved successfully',
    type: TrafficOrderDto,
  })
  async getTrafficOrder(
    @Param('orderId') orderId: string,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<TrafficOrderDto, Error>> {
    return this.trafficService.getTrafficOrder(orderId, userId);
  }

  /**
   * Update traffic order
   */
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
  @ApiResponse({
    status: 200,
    description: 'Traffic order updated successfully',
    type: TrafficOrderDto,
  })
  async updateTrafficOrder(
    @Param('orderId') orderId: string,
    @Body() dto: UpdateTrafficOrderDto,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<TrafficOrderDto, Error>> {
    return this.trafficService.updateTrafficOrder(orderId, dto, userId);
  }

  /**
   * Cancel traffic order
   */
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
  @ApiResponse({
    status: 200,
    description: 'Traffic order cancelled successfully',
    type: TrafficOrderStatusDto,
  })
  async cancelTrafficOrder(
    @Param('orderId') orderId: string,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<TrafficOrderStatusDto, Error>> {
    return this.trafficService.cancelTrafficOrder(orderId, userId);
  }

  /**
   * Get traffic order statistics
   */
  @Get(':orderId/stats')
  @ApiOperation({
    summary: 'Get traffic order statistics',
    description: 'Retrieve detailed statistics and progress for a traffic order',
  })
  @ApiParam({
    name: 'orderId',
    description: 'Traffic order ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Traffic order statistics retrieved successfully',
    type: TrafficOrderStatsDto,
  })
  async getTrafficOrderStats(
    @Param('orderId') orderId: string,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<TrafficOrderStatsDto, Error>> {
    return this.trafficService.getTrafficOrderStats(orderId, userId);
  }

  /**
   * Pause/Resume traffic order
   */
  @Patch(':orderId/status')
  @ApiOperation({
    summary: 'Update traffic order status',
    description: 'Pause, resume, or modify traffic order execution status',
  })
  @ApiParam({
    name: 'orderId',
    description: 'Traffic order ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Traffic order status updated successfully',
    type: TrafficOrderStatusDto,
  })
  async updateTrafficOrderStatus(
    @Param('orderId') orderId: string,
    @Body() dto: TrafficOrderStatusDto,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<TrafficOrderStatusDto, Error>> {
    return this.trafficService.updateTrafficOrderStatus(orderId, dto, userId);
  }
}
