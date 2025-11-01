import { Injectable, Logger } from '@nestjs/common';
import { BotService as BotMainService } from '@app/feature-bot-main';

/**
 * Bot Application Service
 *
 * Thin wrapper around the feature library BotService.
 * This service is a composition root that delegates all business logic
 * to the bot main feature library.
 */
@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(private readonly botMainService: BotMainService) {}

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
