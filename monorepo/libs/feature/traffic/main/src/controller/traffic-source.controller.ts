import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, Ip } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, OptionalAuthGuard } from '@app/feature-auth-shared';
import { ApiProblemExceptions, CurrentUserId } from '@app/common-shared';
import { AsyncResult } from '@app/common-shared';
import {
  CreateBotDto,
  BotDto,
  UpdateBotSettingsDto,
  BotActionDto,
  BotSettingsDto,
  BotTokenValidationDto,
  BotTokenValidationResultDto,
  TrafficSourceDto,
  TrafficSourceStatsDto,
} from '@app/feature-traffic-shared';
import { TrafficService } from '../service/traffic.service';
import { OptionalBotToken, RequiredBotToken, CurrentBotAuth, CurrentBotId } from '@app/feature-traffic-shared';

/**
 * Traffic Source Controller
 * Handles traffic selling operations - creating and managing traffic sources (bots)
 */
@ApiTags('Traffic Sources')
@Controller('traffic/sources')
@ApiProblemExceptions()
export class TrafficSourceController {
  constructor(private readonly trafficService: TrafficService) {}

  /**
   * Validate bot token
   * Public endpoint for bot token validation
   */
  @Post('bot-token/validate')
  @ApiOperation({
    summary: 'Validate bot token',
    description: 'Validate bot token for traffic operations (optional authentication)',
  })
  @ApiResponse({
    status: 200,
    description: 'Token validation result',
    type: BotTokenValidationResultDto,
  })
  async validateBotToken(
    @Body() dto: BotTokenValidationDto,
    @Ip() clientIp: string,
  ): Promise<AsyncResult<BotTokenValidationResultDto, Error>> {
    return this.trafficService.validateBotToken(dto, clientIp);
  }

  /**
   * Get available traffic sources
   * Enhanced features available with bot token
   */
  @Get('available')
  @UseGuards(OptionalAuthGuard)
  @OptionalBotToken()
  @ApiOperation({
    summary: 'Get available traffic sources',
    description: 'Get available traffic sources for purchase (enhanced with bot token)',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by traffic category',
    type: String,
  })
  @ApiQuery({
    name: 'minPrice',
    required: false,
    description: 'Minimum price filter',
    type: Number,
  })
  @ApiQuery({
    name: 'maxPrice',
    required: false,
    description: 'Maximum price filter',
    type: Number,
  })
  @ApiQuery({
    name: 'quality',
    required: false,
    description: 'Quality filter',
    enum: ['low', 'medium', 'high', 'premium'],
  })
  @ApiResponse({
    status: 200,
    description: 'Available traffic sources retrieved successfully',
    type: [TrafficSourceDto],
  })
  async getAvailableTrafficSources(
    @Query('category') category?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('quality') quality?: string,
    @CurrentBotAuth() botAuth?: unknown,
    @CurrentBotId() botId?: string,
  ): Promise<AsyncResult<TrafficSourceDto[], Error>> {
    return this.trafficService.getAvailableTraffic({
      category,
      minPrice,
      maxPrice,
      quality,
      botAuth,
      botId,
    });
  }

  /**
   * Create traffic source (bot)
   * Requires bot token validation
   */
  @Post('bots')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @RequiredBotToken()
  @ApiOperation({
    summary: 'Create traffic source bot',
    description: 'Create a new bot to provide traffic (requires bot token)',
  })
  @ApiResponse({
    status: 201,
    description: 'Traffic source bot created successfully',
    type: BotDto,
  })
  async createTrafficSourceBot(
    @Body() dto: CreateBotDto,
    @CurrentUserId() userId: string,
    @CurrentBotAuth() botAuth: unknown,
    @CurrentBotId() _botId: string,
  ): Promise<AsyncResult<BotDto, Error>> {
    return this.trafficService.createBot(dto, userId, botAuth);
  }

  /**
   * Get managed bots
   * Requires bot token for bot management
   */
  @Get('bots/managed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @RequiredBotToken()
  @ApiOperation({
    summary: 'Get managed traffic source bots',
    description: 'Get all bots managed by the current user (requires bot token)',
  })
  @ApiResponse({
    status: 200,
    description: 'Managed bots retrieved successfully',
    type: [BotDto],
  })
  async getManagedBots(
    @CurrentUserId() userId: string,
    @CurrentBotAuth() botAuth: unknown,
    @CurrentBotId() _botId: string,
  ): Promise<AsyncResult<BotDto[], Error>> {
    return this.trafficService.getUserBots(userId, botAuth);
  }

  /**
   * Get specific bot details
   */
  @Get('bots/:botId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @RequiredBotToken()
  @ApiOperation({
    summary: 'Get traffic source bot details',
    description: 'Get detailed information about a specific bot',
  })
  @ApiParam({
    name: 'botId',
    description: 'Bot ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Bot details retrieved successfully',
    type: BotDto,
  })
  async getBotDetails(
    @Param('botId') botId: string,
    @CurrentUserId() userId: string,
    @CurrentBotAuth() botAuth: unknown,
  ): Promise<AsyncResult<BotDto, Error>> {
    return this.trafficService.getBotDetails(botId, userId, botAuth);
  }

  /**
   * Update bot settings
   */
  @Patch('bots/:botId/settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @RequiredBotToken()
  @ApiOperation({
    summary: 'Update bot settings',
    description: 'Update traffic source bot configuration and settings',
  })
  @ApiParam({
    name: 'botId',
    description: 'Bot ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Bot settings updated successfully',
    type: BotSettingsDto,
  })
  async updateBotSettings(
    @Param('botId') botId: string,
    @Body() dto: UpdateBotSettingsDto,
    @CurrentUserId() userId: string,
    @CurrentBotAuth() botAuth: unknown,
  ): Promise<AsyncResult<BotSettingsDto, any>> {
    return this.trafficService.updateBotSettings(botId, dto, userId, botAuth);
  }

  /**
   * Perform bot action (start/pause/delete)
   */
  @Post('bots/:botId/actions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @RequiredBotToken()
  @ApiOperation({
    summary: 'Perform bot action',
    description: 'Start, pause, or delete a traffic source bot',
  })
  @ApiParam({
    name: 'botId',
    description: 'Bot ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Bot action performed successfully',
    type: BotDto,
  })
  async performBotAction(
    @Param('botId') botId: string,
    @Body() dto: BotActionDto,
    @CurrentUserId() userId: string,
    @CurrentBotAuth() botAuth: unknown,
  ): Promise<AsyncResult<BotDto, Error>> {
    return this.trafficService.performBotAction(botId, dto, userId, botAuth);
  }

  /**
   * Delete traffic source bot
   */
  @Delete('bots/:botId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @RequiredBotToken()
  @ApiOperation({
    summary: 'Delete traffic source bot',
    description: 'Permanently delete a traffic source bot',
  })
  @ApiParam({
    name: 'botId',
    description: 'Bot ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Bot deleted successfully',
  })
  async deleteBot(
    @Param('botId') botId: string,
    @CurrentUserId() userId: string,
    @CurrentBotAuth() botAuth: unknown,
  ): Promise<AsyncResult<void, any>> {
    return this.trafficService.performBotAction(botId, { action: 'delete' }, userId, botAuth);
  }

  /**
   * Get bot statistics
   */
  @Get('bots/:botId/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @RequiredBotToken()
  @ApiOperation({
    summary: 'Get bot statistics',
    description: 'Get detailed statistics for a traffic source bot',
  })
  @ApiParam({
    name: 'botId',
    description: 'Bot ID',
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
    description: 'Bot statistics retrieved successfully',
    type: TrafficSourceStatsDto,
  })
  async getBotStats(
    @Param('botId') botId: string,
    @CurrentUserId() userId: string,
    @CurrentBotAuth() botAuth: unknown,
    @Query('period') period = '7d',
  ): Promise<AsyncResult<TrafficSourceStatsDto, any>> {
    return this.trafficService.getBotStats(botId, userId, period, botAuth);
  }

  /**
   * Get bot earnings
   */
  @Get('bots/:botId/earnings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @RequiredBotToken()
  @ApiOperation({
    summary: 'Get bot earnings',
    description: 'Get earnings information for a traffic source bot',
  })
  @ApiParam({
    name: 'botId',
    description: 'Bot ID',
    type: String,
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: 'Earnings period',
    enum: ['24h', '7d', '30d', '90d'],
  })
  @ApiResponse({
    status: 200,
    description: 'Bot earnings retrieved successfully',
  })
  async getBotEarnings(
    @Param('botId') botId: string,
    @CurrentUserId() userId: string,
    @CurrentBotAuth() botAuth: unknown,
    @Query('period') period = '30d',
  ): Promise<AsyncResult<any, any>> {
    return this.trafficService.getBotEarnings(botId, userId, period, botAuth);
  }
}
