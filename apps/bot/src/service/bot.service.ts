import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BotService as BotMainService } from '@app/feature-bot-main';
import { ModerationCallbackHandler } from '../handler';

/**
 * Bot Application Service
 *
 * Thin wrapper around the feature library BotService.
 * This service is a composition root that delegates all business logic
 * to the bot main feature library.
 *
 * Registers app-layer handlers (like moderation) that require cross-module dependencies.
 */
@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);

  constructor(
    private readonly botMainService: BotMainService,
    private readonly moderationHandler: ModerationCallbackHandler,
  ) {}

  /**
   * Register app-layer interceptors on module init
   */
  onModuleInit(): void {
    // Register moderation callback interceptor
    // This runs at the app layer where both bot-main and traffic-main are available
    this.botMainService.registerCallbackInterceptor((ctx) => this.moderationHandler.handleCallback(ctx));

    this.logger.log('Registered moderation callback interceptor');
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    try {
      await this.botMainService.start();
      this.logger.log('Bot application service started successfully');
    } catch (error: unknown) {
      this.logger.error('Failed to start bot application service', error);
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    try {
      await this.botMainService.stop();
      this.logger.log('Bot application service stopped successfully');
    } catch (error: unknown) {
      this.logger.error('Error stopping bot application service', error);
    }
  }
}
