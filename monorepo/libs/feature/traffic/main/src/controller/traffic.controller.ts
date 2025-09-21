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
  HttpStatus,
  Req,
  Ip,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiHeader } from '@nestjs/swagger';
import { CurrentUserId, JwtAuthGuard, OptionalAuth } from '@app/feature-auth-shared';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { ClientDataProblemValidationException } from '@app/common-validation';
import { AsyncResult } from '@app/common-shared';
import { FastifyRequest } from 'fastify';
import { TrafficService } from '../service';
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
  BotTokenValidationDto,
  BotTokenValidationResponseDto,
  BotTokenValidationGuard,
  CurrentBotAuth,
  CurrentBotId,
  TrafficSellAuth,
  BotManagementAuth,
  TrafficAnalyticsAuth,
} from '@app/feature-traffic-shared';

/**
 * Controller for managing traffic bots and traffic purchases
 */
@ApiTags('Traffic')
@Controller('traffic')
@UseGuards(JwtAuthGuard, BotTokenValidationGuard)
@ApiBearerAuth()
@ApiProblemExceptions([
  [InternalException, { description: 'Internal server error occurred' }],
  [ClientDataProblemValidationException, { description: 'Request validation failed' }],
])
export class TrafficController {
  constructor(private readonly trafficService: TrafficService) {}

  // =====================================================
  // BOT TOKEN VALIDATION ENDPOINTS
  // =====================================================

  @Post('bot-token/validate')
  @HttpCode(HttpStatus.OK)
  @OptionalAuth()
  @ApiOperation({
    summary: 'Validate bot token for traffic operations',
    description: 'Validates a bot token and returns bot information and permissions for traffic operations',
  })
  @ApiResponse({
    status: 200,
    description: 'Token validation result',
    type: BotTokenValidationResponseDto,
  })
  @ApiHeader({
    name: 'X-Bot-Token',
    description: 'Bot token to validate (alternative to Authorization header)',
    required: false,
  })
  async validateBotToken(
    @Body() dto: BotTokenValidationDto,
    @Ip() clientIp: string,
  ): Promise<BotTokenValidationResponseDto> {
    return this.trafficService.validateBotToken(dto, clientIp);
  }

  @Get('bot-token/permissions/:botId')
  @ApiOperation({
    summary: 'Get bot permissions for traffic operations',
    description: 'Returns available permissions for a specific bot',
  })
  @ApiParam({ name: 'botId', description: 'Bot ID' })
  @ApiResponse({
    status: 200,
    description: 'Bot permissions',
    schema: {
      type: 'object',
      properties: {
        botId: { type: 'string' },
        permissions: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async getBotPermissions(@Param('botId') botId: string): Promise<{ botId: string; permissions: string[] }> {
    const permissions = await this.trafficService.getBotPermissions(botId);

    return { botId, permissions };
  }

  @Post('bot-token/invalidate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Invalidate bot token',
    description: 'Invalidates a bot token for security purposes',
  })
  @ApiResponse({
    status: 204,
    description: 'Token invalidated successfully',
  })
  async invalidateBotToken(@Body() body: { token: string }): Promise<void> {
    await this.trafficService.invalidateBotToken(body.token);
  }

  // =====================================================
  // ENHANCED TRAFFIC SELL OPERATIONS WITH TOKEN AUTH
  // =====================================================

  @Get('sell/available')
  @TrafficSellAuth()
  @ApiOperation({
    summary: 'Get available traffic for sale (enhanced with bot auth)',
    description: 'Returns available traffic types with optional bot token authentication for enhanced features',
  })
  @ApiHeader({
    name: 'X-Bot-Token',
    description: 'Optional bot token for enhanced features',
    required: false,
  })
  async getAvailableTrafficForSell(
    @CurrentBotAuth() botAuth?: unknown,
    @CurrentBotId() botId?: string,
  ): Promise<AvailableTrafficDto[]> {
    const traffic = await this.trafficService.getAvailableTraffic();

    // If bot is authenticated, could add enhanced features
    if (botAuth && botId) {
      // Add bot-specific enhancements to traffic data
      return traffic.map((item) => ({
        ...item,
        metadata: {
          botEnhanced: true,
          botId,
          preferredPricing: true, // Bot users might get better pricing
        },
      }));
    }

    return traffic;
  }

  @Get('analytics/bot')
  @TrafficAnalyticsAuth()
  @ApiOperation({
    summary: 'Get traffic analytics with bot authentication',
    description: 'Returns traffic analytics data with optional bot token authentication',
  })
  @ApiHeader({
    name: 'X-Bot-Token',
    description: 'Optional bot token for bot-specific analytics',
    required: false,
  })
  async getBotTrafficAnalytics(
    @CurrentUserId() userId: string,
    @CurrentBotAuth() botAuth?: unknown,
    @CurrentBotId() botId?: string,
  ): Promise<any> {
    const basicAnalytics = {
      totalOrders: 0,
      totalEarnings: '0.00',
      activeOrders: 0,
      completedOrders: 0,
    };

    if (botAuth && botId) {
      // Add bot-specific analytics
      return {
        ...basicAnalytics,
        botSpecific: {
          botId,
          botUsername: botAuth.botUsername,
          permissions: botAuth.permissions,
          tokenExpiry: botAuth.expiresAt,
          enhancedFeatures: ['real_time_tracking', 'advanced_analytics', 'priority_support'],
        },
      };
    }

    return basicAnalytics;
  }

  // =====================================================
  // BOT MANAGEMENT WITH REQUIRED TOKEN AUTH
  // =====================================================

  @Get('bots/managed')
  @BotManagementAuth()
  @ApiOperation({
    summary: 'Get managed bots (requires bot token)',
    description: 'Returns bots managed by the authenticated bot token',
  })
  @ApiHeader({
    name: 'X-Bot-Token',
    description: 'Bot token required for bot management operations',
    required: true,
  })
  async getManagedBots(
    @CurrentUserId() userId: string,
    @CurrentBotAuth() botAuth: unknown,
    @CurrentBotId() _botId: string,
  ): Promise<BotResponseDto[]> {
    // This would filter bots managed by the specific bot token
    const allBots = await this.trafficService.getUserBots(userId);

    return allBots.map((bot) => ({
      ...bot,
      managedByBot: botId,
      enhancedManagement: true,
    }));
  }
}
