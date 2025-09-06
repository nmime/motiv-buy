import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CurrentUserId, JwtAuthGuard, UnauthorizedException } from '@app/feature-auth-shared';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { ClientDataProblemValidationException } from '@app/common-validation';
import { AsyncResult } from '@app/common-shared';
import { TrafficService } from '../service/traffic.service';
import {
  CreateBotDto,
  BotValidationDto,
  BotCreationResponseDto,
  BotSettingsDto,
  UpdateBotSettingsDto,
  BotActionDto,
  BotResponseDto,
  CreateTrafficOrderDto,
  TrafficOrderResponseDto,
  UpdateTrafficOrderDto,
  AvailableTrafficDto,
} from '@app/feature-traffic-shared';

/**
 * Controller for managing traffic bots and traffic purchases
 */
@ApiTags('Traffic')
@Controller('traffic')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiProblemExceptions([
  [UnauthorizedException, { description: 'User not authenticated' }],
  [InternalException, { description: 'Internal server error occurred' }],
  [ClientDataProblemValidationException, { description: 'Request validation failed' }],
])
export class TrafficController {
  constructor(private readonly trafficService: TrafficService) {}

  // Bot management endpoints

  @Post('bots/validate')
  @ApiOperation({ summary: 'Validate bot existence' })
  @ApiResponse({
    status: 200,
    description: 'Bot validation result',
    schema: {
      type: 'object',
      properties: {
        exists: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async validateBot(
    @Body() dto: BotValidationDto,
  ): AsyncResult<any, ClientDataProblemValidationException | InternalException> {
    const result = await this.trafficService.validateBot(dto);
    return { success: true, data: result };
  }

  @Post('bots')
  @ApiOperation({ summary: 'Create new bot for traffic sales' })
  @ApiResponse({
    status: 201,
    description: 'Bot created successfully',
    type: BotCreationResponseDto,
  })
  async createBot(
    @CurrentUserId() userId: string,
    @Body() dto: CreateBotDto,
  ): AsyncResult<BotCreationResponseDto, UnauthorizedException | InternalException> {
    const result = await this.trafficService.createBot(userId, dto);
    return { success: true, data: result };
  }

  @Get('bots')
  @ApiOperation({ summary: 'Get all user bots' })
  @ApiResponse({
    status: 200,
    description: 'List of user bots',
    type: [BotResponseDto],
  })
  async getUserBots(
    @CurrentUserId() userId: string,
  ): AsyncResult<BotResponseDto[], UnauthorizedException | InternalException> {
    const result = await this.trafficService.getUserBots(userId);
    return { success: true, data: result };
  }

  @Get('bots/:botId')
  @ApiOperation({ summary: 'Get specific bot details' })
  @ApiParam({ name: 'botId', description: 'Bot ID' })
  @ApiResponse({
    status: 200,
    description: 'Bot details',
    type: BotResponseDto,
  })
  async getBotDetails(
    @CurrentUserId() userId: string,
    @Param('botId') botId: string,
  ): AsyncResult<BotResponseDto, UnauthorizedException | InternalException> {
    const result = await this.trafficService.getBotDetails(userId, botId);
    return { success: true, data: result };
  }

  @Get('bots/:botId/settings')
  @ApiOperation({ summary: 'Get bot settings' })
  @ApiParam({ name: 'botId', description: 'Bot ID' })
  @ApiResponse({
    status: 200,
    description: 'Bot settings',
    type: BotSettingsDto,
  })
  async getBotSettings(
    @CurrentUserId() userId: string,
    @Param('botId') botId: string,
  ): AsyncResult<BotSettingsDto, UnauthorizedException | InternalException> {
    const result = await this.trafficService.getBotSettings(userId, botId);
    return { success: true, data: result };
  }

  @Put('bots/:botId/settings')
  @ApiOperation({ summary: 'Update bot settings' })
  @ApiParam({ name: 'botId', description: 'Bot ID' })
  @ApiResponse({
    status: 200,
    description: 'Updated bot settings',
    type: BotSettingsDto,
  })
  async updateBotSettings(
    @CurrentUserId() userId: string,
    @Param('botId') botId: string,
    @Body() dto: UpdateBotSettingsDto,
  ): AsyncResult<BotSettingsDto, UnauthorizedException | InternalException> {
    const result = await this.trafficService.updateBotSettings(userId, botId, dto);
    return { success: true, data: result };
  }

  @Post('bots/:botId/actions')
  @ApiOperation({ summary: 'Perform bot action (start/pause/delete)' })
  @ApiParam({ name: 'botId', description: 'Bot ID' })
  @ApiResponse({
    status: 200,
    description: 'Action performed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  async performBotAction(
    @CurrentUserId() userId: string,
    @Param('botId') botId: string,
    @Body() dto: BotActionDto,
  ): AsyncResult<{ message: string }, UnauthorizedException | InternalException> {
    const result = await this.trafficService.performBotAction(userId, botId, dto);
    return { success: true, data: result };
  }

  // Traffic purchase endpoints

  @Get('available')
  @ApiOperation({ summary: 'Get available traffic types and prices' })
  @ApiResponse({
    status: 200,
    description: 'Available traffic types',
    type: [AvailableTrafficDto],
  })
  async getAvailableTraffic(): AsyncResult<AvailableTrafficDto[], UnauthorizedException | InternalException> {
    const result = await this.trafficService.getAvailableTraffic();
    return { success: true, data: result };
  }

  @Post('orders')
  @ApiOperation({ summary: 'Create new traffic purchase order' })
  @ApiResponse({
    status: 201,
    description: 'Traffic order created successfully',
    type: TrafficOrderResponseDto,
  })
  async createTrafficOrder(
    @CurrentUserId() userId: string,
    @Body() dto: CreateTrafficOrderDto,
  ): AsyncResult<TrafficOrderResponseDto, UnauthorizedException | InternalException> {
    const result = await this.trafficService.createTrafficOrder(userId, dto);
    return { success: true, data: result };
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get user traffic orders' })
  @ApiResponse({
    status: 200,
    description: 'List of user traffic orders',
    type: [TrafficOrderResponseDto],
  })
  async getUserTrafficOrders(
    @CurrentUserId() userId: string,
  ): AsyncResult<TrafficOrderResponseDto[], UnauthorizedException | InternalException> {
    const result = await this.trafficService.getUserTrafficOrders(userId);
    return { success: true, data: result };
  }

  @Get('orders/:orderId')
  @ApiOperation({ summary: 'Get specific traffic order details' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Traffic order details',
    type: TrafficOrderResponseDto,
  })
  async getTrafficOrder(
    @CurrentUserId() userId: string,
    @Param('orderId') orderId: string,
  ): AsyncResult<TrafficOrderResponseDto, UnauthorizedException | InternalException> {
    const result = await this.trafficService.getTrafficOrder(userId, orderId);
    return { success: true, data: result };
  }

  @Put('orders/:orderId')
  @ApiOperation({ summary: 'Update traffic order' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Updated traffic order',
    type: TrafficOrderResponseDto,
  })
  async updateTrafficOrder(
    @CurrentUserId() userId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateTrafficOrderDto,
  ): AsyncResult<TrafficOrderResponseDto, UnauthorizedException | InternalException> {
    const result = await this.trafficService.updateTrafficOrder(userId, orderId, dto);
    return { success: true, data: result };
  }

  @Delete('orders/:orderId')
  @ApiOperation({ summary: 'Cancel traffic order' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  async cancelTrafficOrder(
    @CurrentUserId() userId: string,
    @Param('orderId') orderId: string,
  ): AsyncResult<{ message: string }, UnauthorizedException | InternalException> {
    const result = await this.trafficService.cancelTrafficOrder(userId, orderId);
    return { success: true, data: result };
  }
}
