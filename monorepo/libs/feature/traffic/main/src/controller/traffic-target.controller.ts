import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUserId } from '@app/feature-auth-shared';
import { ApiProblemExceptions } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';
import {
  CreateTrafficTargetDto,
  TrafficTargetDto,
  UpdateTrafficTargetDto,
  TrafficTargetStatsDto,
  TrafficTargetValidationDto,
} from '@app/feature-traffic-shared';
import { TrafficService } from '../service/traffic.service';

/**
 * Traffic Target Controller
 * Handles traffic target operations - managing channels/groups that receive traffic
 */
@ApiTags('Traffic Targets')
@Controller('traffic/targets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiProblemExceptions([])
export class TrafficTargetController {
  constructor(private readonly trafficService: TrafficService) {}

  /**
   * Create a new traffic target
   */
  @Post()
  @ApiOperation({
    summary: 'Create traffic target',
    description: 'Create a new traffic target (channel/group) for receiving traffic',
  })
  @ApiResponse({
    status: 201,
    description: 'Traffic target created successfully',
    type: TrafficTargetDto,
  })
  async createTrafficTarget(
    @Body() dto: CreateTrafficTargetDto,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<TrafficTargetDto, any>> {
    return this.trafficService.createTrafficTarget(dto, userId);
  }

  /**
   * Get user's traffic targets
   */
  @Get()
  @ApiOperation({
    summary: 'Get user traffic targets',
    description: 'Retrieve all traffic targets for the current user',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by target type',
    enum: ['channel', 'group', 'chat'],
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by target status',
    enum: ['active', 'inactive', 'pending_verification'],
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of targets to return',
    type: Number,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of targets to skip',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'User traffic targets retrieved successfully',
    type: [TrafficTargetDto],
  })
  async getUserTrafficTargets(
    @CurrentUserId() userId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<AsyncResult<TrafficTargetDto[], any>> {
    return this.trafficService.getUserTrafficTargets(userId, {
      type,
      status,
      limit,
      offset,
    });
  }

  /**
   * Get specific traffic target details
   */
  @Get(':targetId')
  @ApiOperation({
    summary: 'Get traffic target details',
    description: 'Retrieve detailed information about a specific traffic target',
  })
  @ApiParam({
    name: 'targetId',
    description: 'Traffic target ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Traffic target details retrieved successfully',
    type: TrafficTargetDto,
  })
  async getTrafficTarget(
    @Param('targetId') targetId: string,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<TrafficTargetDto, any>> {
    return this.trafficService.getTrafficTarget(targetId, userId);
  }

  /**
   * Update traffic target
   */
  @Patch(':targetId')
  @ApiOperation({
    summary: 'Update traffic target',
    description: 'Update traffic target settings and configuration',
  })
  @ApiParam({
    name: 'targetId',
    description: 'Traffic target ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Traffic target updated successfully',
    type: TrafficTargetDto,
  })
  async updateTrafficTarget(
    @Param('targetId') targetId: string,
    @Body() dto: UpdateTrafficTargetDto,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<TrafficTargetDto, any>> {
    return this.trafficService.updateTrafficTarget(targetId, dto, userId);
  }

  /**
   * Delete traffic target
   */
  @Delete(':targetId')
  @ApiOperation({
    summary: 'Delete traffic target',
    description: 'Delete a traffic target and cancel any associated orders',
  })
  @ApiParam({
    name: 'targetId',
    description: 'Traffic target ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Traffic target deleted successfully',
  })
  async deleteTrafficTarget(
    @Param('targetId') targetId: string,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<void, any>> {
    return this.trafficService.deleteTrafficTarget(targetId, userId);
  }

  /**
   * Validate traffic target
   */
  @Post(':targetId/validate')
  @ApiOperation({
    summary: 'Validate traffic target',
    description: 'Validate that a traffic target is accessible and properly configured',
  })
  @ApiParam({
    name: 'targetId',
    description: 'Traffic target ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Traffic target validation completed',
    type: TrafficTargetValidationDto,
  })
  async validateTrafficTarget(
    @Param('targetId') targetId: string,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<TrafficTargetValidationDto, any>> {
    return this.trafficService.validateTrafficTarget(targetId, userId);
  }

  /**
   * Get traffic target statistics
   */
  @Get(':targetId/stats')
  @ApiOperation({
    summary: 'Get traffic target statistics',
    description: 'Retrieve detailed statistics for a traffic target',
  })
  @ApiParam({
    name: 'targetId',
    description: 'Traffic target ID',
    type: String,
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: 'Statistics period',
    enum: ['24h', '7d', '30d', '90d'],
  })
  @ApiResponse({
    status: 200,
    description: 'Traffic target statistics retrieved successfully',
    type: TrafficTargetStatsDto,
  })
  async getTrafficTargetStats(
    @Param('targetId') targetId: string,
    @CurrentUserId() userId: string,
    @Query('period') period = '7d',
  ): Promise<AsyncResult<TrafficTargetStatsDto, any>> {
    return this.trafficService.getTrafficTargetStats(targetId, userId, period);
  }

  /**
   * Get active orders for target
   */
  @Get(':targetId/orders')
  @ApiOperation({
    summary: 'Get target active orders',
    description: 'Retrieve all active orders for a specific traffic target',
  })
  @ApiParam({
    name: 'targetId',
    description: 'Traffic target ID',
    type: String,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by order status',
    enum: ['pending', 'active', 'completed', 'cancelled'],
  })
  @ApiResponse({
    status: 200,
    description: 'Target orders retrieved successfully',
    type: Array,
  })
  async getTargetOrders(
    @Param('targetId') targetId: string,
    @CurrentUserId() userId: string,
    @Query('status') status?: string,
  ): Promise<AsyncResult<any[], any>> {
    return this.trafficService.getTargetOrders(targetId, userId, status);
  }
}
