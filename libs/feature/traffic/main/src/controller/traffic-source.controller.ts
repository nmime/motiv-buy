import { Body, Controller, Get, Ip, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUserId, JwtAuthGuard } from '@app/feature-auth-shared';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { ClientDataProblemValidationException } from '@app/common-validation';
import { AsyncResult } from '@app/common-shared';
import { Ok } from 'ts-results';
import {
  AvailableTrafficDto,
  BotActionDto,
  BotCreationResponseDto,
  BotDto,
  BotResponseDto,
  BotSettingsDto,
  BotTokenValidationDto,
  BotTokenValidationResultDto,
  CreateBotDto,
  OptionalBotToken,
  RequiredBotToken,
  UpdateBotSettingsDto,
} from '@app/feature-traffic-shared';
import { TrafficService } from '../service/traffic.service';

/**
 * Traffic Source Controller
 * Handles traffic selling operations - creating and managing traffic sources (bots)
 */
@ApiTags('Traffic Sources')
@Controller('traffic/sources')
@ApiProblemExceptions([
  [InternalException, { description: 'Internal server error occurred' }],
  [ClientDataProblemValidationException, { description: 'Request validation failed' }],
])
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
  @ApiOkResponse({
    description: 'Token validation result',
    type: BotTokenValidationResultDto,
  })
  async validateBotToken(
    @Body() dto: BotTokenValidationDto,
    @Ip() clientIp: string,
  ): Promise<AsyncResult<BotTokenValidationResultDto, Error>> {
    const result = await this.trafficService.validateBotToken(dto, clientIp);

    return Ok(result);
  }

  /**
   * Get available traffic sources
   * Enhanced features available with bot token
   */
  @Get('available')
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
  @ApiOkResponse({
    description: 'Available traffic sources retrieved successfully',
    type: [AvailableTrafficDto],
  })
  async getAvailableTrafficSources(): Promise<AsyncResult<AvailableTrafficDto[], Error>> {
    const result = await this.trafficService.getAvailableTraffic();

    return Ok(result);
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
  @ApiOkResponse({
    description: 'Traffic source bot created successfully',
    type: BotDto,
  })
  async createTrafficSourceBot(
    @Body() dto: CreateBotDto,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<BotCreationResponseDto, Error>> {
    const result = await this.trafficService.createBot(dto, userId);

    return Ok(result);
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
  @ApiOkResponse({
    description: 'Managed bots retrieved successfully',
    type: [BotDto],
  })
  async getManagedBots(@CurrentUserId() userId: string): Promise<AsyncResult<BotResponseDto[], Error>> {
    const result = await this.trafficService.getUserBots(userId);

    return Ok(result);
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
  @ApiOkResponse({
    description: 'Bot details retrieved successfully',
    type: BotDto,
  })
  async getBotDetails(
    @Param('botId') botId: string,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<BotResponseDto, Error>> {
    const result = await this.trafficService.getBotDetails(botId, userId);

    return Ok(result);
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
  @ApiOkResponse({
    description: 'Bot settings updated successfully',
    type: BotSettingsDto,
  })
  async updateBotSettings(
    @Param('botId') botId: string,
    @Body() dto: UpdateBotSettingsDto,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<BotSettingsDto, Error>> {
    const result = await this.trafficService.updateBotSettings(botId, dto, userId);

    return Ok(result);
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
  @ApiOkResponse({
    description: 'Bot action performed successfully',
  })
  async performBotAction(
    @Param('botId') botId: string,
    @Body() dto: BotActionDto,
    @CurrentUserId() userId: string,
  ): Promise<AsyncResult<{ message: string }, Error>> {
    const result = await this.trafficService.performBotAction(botId, dto, userId);

    return Ok(result);
  }
}
