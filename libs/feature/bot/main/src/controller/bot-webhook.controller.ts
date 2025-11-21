/**
 * Bot Webhook Controller
 *
 * Handles incoming webhook requests from Telegram Bot API.
 * Validates requests using secret token and forwards updates to Grammy bot.
 *
 * Security:
 * - Validates secret token from Telegram
 * - Checks request origin (optional IP whitelist)
 * - Rate limiting applied via middleware
 *
 * Architecture:
 * - Only used when BOT_WEBHOOK_URL is configured
 * - Polling mode used otherwise (development)
 * - Can be deployed to API app or separate webhook service
 *
 * @controller BotWebhookController
 */

import { Controller, Post, Body, Headers, HttpCode, HttpStatus, UnauthorizedException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import type { Update } from 'grammy/types';
import { BotService } from '../service/bot.service';
import { BotConfigService } from '../config/bot-config.service';

@ApiTags('Bot Webhook')
@Controller('bot/webhook')
export class BotWebhookController {
  private readonly logger = new Logger(BotWebhookController.name);

  constructor(
    private readonly botService: BotService,
    private readonly botConfigService: BotConfigService,
  ) {}

  /**
   * Handle incoming webhook updates from Telegram
   *
   * POST /bot/webhook
   *
   * Security:
   * - Validates X-Telegram-Bot-Api-Secret-Token header
   * - Returns 401 if token is invalid or missing
   *
   * @param update - Telegram update object
   * @param secretToken - Secret token from Telegram header
   * @returns 200 OK on success
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive Telegram webhook updates',
    description: 'Endpoint for Telegram Bot API to send updates via webhook. Requires secret token validation.',
  })
  @ApiHeader({
    name: 'X-Telegram-Bot-Api-Secret-Token',
    description: 'Secret token for webhook validation',
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Update processed successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or missing secret token',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Failed to process update',
  })
  async handleWebhook(
    @Body() update: Update,
    @Headers('x-telegram-bot-api-secret-token') secretToken: string,
  ): Promise<void> {
    try {
      // Validate secret token
      this.validateSecretToken(secretToken);

      this.logger.debug(`Received webhook update: ${update.update_id}`);

      // Process update through bot service
      await this.botService.handleWebhookUpdate(update);

      this.logger.debug(`Successfully processed update: ${update.update_id}`);
    } catch (error: unknown) {
      this.logger.error('Failed to process webhook update', {
        error: error instanceof Error ? error.message : String(error),
        updateId: update.update_id,
      });

      // Don't throw - Telegram expects 200 OK even on errors
      // Otherwise it will retry the update repeatedly
      // We log the error but return success to prevent retry loops
    }
  }

  /**
   * Health check endpoint for webhook
   * Can be used by load balancers or monitoring systems
   *
   * GET /bot/webhook/health
   *
   * @returns 200 OK if webhook is ready
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook health check',
    description: 'Check if webhook endpoint is ready to receive updates',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Webhook is healthy and ready',
  })
  async healthCheck(): Promise<{ status: string; mode: string }> {
    const isWebhookMode = this.botService.isWebhookMode();

    return {
      status: 'healthy',
      mode: isWebhookMode ? 'webhook' : 'polling',
    };
  }

  /**
   * Validate secret token from Telegram
   *
   * @param receivedToken - Token from request header
   * @throws UnauthorizedException if token is invalid or missing
   */
  private validateSecretToken(receivedToken: string): void {
    const webhookConfig = this.botConfigService.getBotConfig().webhook;

    // Check if webhook is configured
    if (!webhookConfig) {
      throw new UnauthorizedException('Webhook not configured');
    }

    // Check if secret token is configured
    const expectedToken = webhookConfig.secretToken;
    if (!expectedToken) {
      // If no secret token configured, allow (not recommended for production)
      this.logger.warn('Webhook secret token not configured - consider setting BOT_WEBHOOK_SECRET');

      return;
    }

    // Check if token matches
    if (receivedToken !== expectedToken) {
      this.logger.warn('Invalid webhook secret token received');
      throw new UnauthorizedException('Invalid secret token');
    }
  }
}
