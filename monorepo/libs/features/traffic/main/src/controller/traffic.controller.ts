import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CurrentUser } from '@libs/features/auth/shared';
import { JwtAuthGuard } from '@libs/features/auth/main';
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
} from '@libs/features/traffic/shared';

/**
 * Controller for managing traffic bots and traffic purchases
 */
@ApiTags('Traffic')
@Controller('traffic')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
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
        message: { type: 'string' }
      }
    }
  })
  async validateBot(@Body() dto: BotValidationDto) {
    return this.trafficService.validateBot(dto);
  }

  @Post('bots')
  @ApiOperation({ summary: 'Create new bot for traffic sales' })
  @ApiResponse({
    status: 201,
    description: 'Bot created successfully',
    type: BotCreationResponseDto,
  })
  async createBot(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBotDto,
  ): Promise<BotCreationResponseDto> {
    return this.trafficService.createBot(userId, dto);
  }

  @Get('bots')
  @ApiOperation({ summary: 'Get all user bots' })
  @ApiResponse({
    status: 200,
    description: 'List of user bots',
    type: [BotResponseDto],
  })
  async getUserBots(@CurrentUser('id') userId: string): Promise<BotResponseDto[]> {
    return this.trafficService.getUserBots(userId);
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
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
  ): Promise<BotResponseDto> {
    return this.trafficService.getBotDetails(userId, botId);
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
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
  ): Promise<BotSettingsDto> {
    return this.trafficService.getBotSettings(userId, botId);
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
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
    @Body() dto: UpdateBotSettingsDto,
  ): Promise<BotSettingsDto> {
    return this.trafficService.updateBotSettings(userId, botId, dto);
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
        message: { type: 'string' }
      }
    }
  })
  async performBotAction(
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
    @Body() dto: BotActionDto,
  ): Promise<{ message: string }> {
    return this.trafficService.performBotAction(userId, botId, dto);
  }

  // Traffic purchase endpoints

  @Get('available')
  @ApiOperation({ summary: 'Get available traffic types and prices' })
  @ApiResponse({
    status: 200,
    description: 'Available traffic types',
    type: [AvailableTrafficDto],
  })
  async getAvailableTraffic(): Promise<AvailableTrafficDto[]> {
    return this.trafficService.getAvailableTraffic();
  }

  @Post('orders')
  @ApiOperation({ summary: 'Create new traffic purchase order' })
  @ApiResponse({
    status: 201,
    description: 'Traffic order created successfully',
    type: TrafficOrderResponseDto,
  })
  async createTrafficOrder(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTrafficOrderDto,
  ): Promise<TrafficOrderResponseDto> {
    return this.trafficService.createTrafficOrder(userId, dto);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get user traffic orders' })
  @ApiResponse({
    status: 200,
    description: 'List of user traffic orders',
    type: [TrafficOrderResponseDto],
  })
  async getUserTrafficOrders(@CurrentUser('id') userId: string): Promise<TrafficOrderResponseDto[]> {
    return this.trafficService.getUserTrafficOrders(userId);
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
    @CurrentUser('id') userId: string,
    @Param('orderId') orderId: string,
  ): Promise<TrafficOrderResponseDto> {
    return this.trafficService.getTrafficOrder(userId, orderId);
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
    @CurrentUser('id') userId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateTrafficOrderDto,
  ): Promise<TrafficOrderResponseDto> {
    return this.trafficService.updateTrafficOrder(userId, orderId, dto);
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
        message: { type: 'string' }
      }
    }
  })
  @HttpCode(HttpStatus.OK)
  async cancelTrafficOrder(
    @CurrentUser('id') userId: string,
    @Param('orderId') orderId: string,
  ): Promise<{ message: string }> {
    return this.trafficService.cancelTrafficOrder(userId, orderId);
  }
}