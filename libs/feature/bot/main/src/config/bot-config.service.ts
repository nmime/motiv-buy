/**
 * Bot Configuration Service
 *
 * Manages bot configuration, validation, and environment-specific settings.
 * Integrates with NestJS configuration module for secure configuration management.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotConfig } from '@app/feature-bot-shared';

@Injectable()
export class BotConfigService {
  private runtimeBotUsername: string | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Set the bot username after bot initialization
   * Called by BotService after bot.init()
   *
   * @param username - Bot username from Telegram API
   */
  setBotUsername(username: string): void {
    this.runtimeBotUsername = username;
  }

  /**
   * Get the bot username (from runtime or environment)
   *
   * @returns Bot username
   */
  getBotUsername(): string {
    return this.runtimeBotUsername || this.configService.get<string>('BOT_USERNAME', '');
  }

  /**
   * Get bot configuration
   *
   * @returns Bot configuration object
   */
  getBotConfig(): BotConfig {
    return {
      token: this.configService.get<string>('TELEGRAM_BOT_TOKEN', ''),
      username: this.configService.get<string>('BOT_USERNAME'),
      displayName: this.configService.get<string>('BOT_DISPLAY_NAME'),
      description: this.configService.get<string>('BOT_DESCRIPTION'),
      environment: {
        name: this.configService.get<'development' | 'staging' | 'production'>('NODE_ENV', 'development'),
        debug: this.configService.get<boolean>('BOT_DEBUG', false),
        verbose: this.configService.get<boolean>('BOT_VERBOSE', false),
        apiUrl: this.configService.get<string>('API_URL'),
        frontendUrl: this.configService.get<string>('FRONTEND_URL'),
        adminChatIds: this.getAdminChatIds(),
        version: this.configService.get<string>('BOT_VERSION', '1.0.0'),
      },
      webhook: this.getWebhookConfig(),
      polling: this.getPollingConfig(),
      session: {
        storage: 'redis',
        timeout: this.configService.get<number>('BOT_SESSION_TIMEOUT', 3600),
        cleanupInterval: this.configService.get<number>('BOT_SESSION_CLEANUP_INTERVAL', 300),
        maxSessionsPerUser: this.configService.get<number>('BOT_MAX_SESSIONS_PER_USER', 5),
        keyPrefix: 'bot:session:',
      },
      rateLimit: {
        enabled: this.configService.get<boolean>('BOT_RATE_LIMIT_ENABLED', true),
        requestsPerMinute: this.configService.get<number>('BOT_RATE_LIMIT_RPM', 30),
        burstCapacity: this.configService.get<number>('BOT_RATE_LIMIT_BURST', 5),
        windowSize: this.configService.get<number>('BOT_RATE_LIMIT_WINDOW', 60),
        storage: 'redis',
        skipAdmins: true,
      },
      logging: {
        level: this.configService.get<'debug' | 'info' | 'warn' | 'error'>('BOT_LOG_LEVEL', 'info'),
        format: this.configService.get<'json' | 'text'>('BOT_LOG_FORMAT', 'json'),
        console: true,
        correlation: true,
      },
      features: {
        userRegistration: true,
        analytics: true,
        adminCommands: true,
        fileUploads: false,
        voiceMessages: false,
        locationSharing: false,
        groupFeatures: false,
        channelFeatures: false,
      },
      middleware: {
        auth: true,
        rateLimit: true,
        logging: true,
        errorHandling: true,
        session: true,
        analytics: true,
        security: true,
        performance: true,
      },
      security: {
        inputValidation: true,
        maxMessageLength: 4096,
        maxFileSize: 10,
        spamProtection: {
          enabled: true,
          maxMessagesPerMinute: 10,
          duplicateThreshold: 3,
          autoBan: false,
          banDuration: 60,
        },
        adminVerification: {
          required: true,
          adminIds: this.getAdminChatIds(),
          sessionTimeout: 3600,
        },
      },
      performance: {
        caching: true,
        cacheTtl: 300,
        batching: false,
        lazyLoading: true,
        responseTimeout: 30,
      },
    };
  }

  /**
   * Get bot token
   *
   * @returns Bot token
   */
  getBotToken(): string {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
    }

    return token;
  }

  /**
   * Check if development mode
   *
   * @returns True if development mode
   */
  isDevelopment(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'development';
  }

  /**
   * Check if production mode
   *
   * @returns True if production mode
   */
  isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Get API documentation URL for traffic source integration
   *
   * @returns API docs URL or undefined if not configured
   */
  getApiDocsUrl(): string | undefined {
    return this.configService.get<string>('API_DOCS_URL');
  }

  /**
   * Get admin chat IDs
   *
   * @returns Array of admin chat IDs
   */
  private getAdminChatIds(): number[] {
    const adminIds = this.configService.get<string>('BOT_ADMIN_IDS', '');
    if (!adminIds) {
      return [];
    }

    return adminIds
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id));
  }

  /**
   * Get webhook configuration
   *
   * @returns Webhook configuration or undefined
   */
  private getWebhookConfig() {
    const webhookUrl = this.configService.get<string>('BOT_WEBHOOK_URL');
    if (!webhookUrl) {
      return undefined;
    }

    return {
      url: webhookUrl,
      secretToken: this.configService.get<string>('BOT_WEBHOOK_SECRET'),
      port: this.configService.get<number>('BOT_WEBHOOK_PORT', 3000),
      path: this.configService.get<string>('BOT_WEBHOOK_PATH', '/webhook'),
      maxConnections: this.configService.get<number>('BOT_WEBHOOK_MAX_CONNECTIONS', 40),
    };
  }

  /**
   * Get polling configuration
   *
   * @returns Polling configuration
   */
  private getPollingConfig() {
    return {
      timeout: this.configService.get<number>('BOT_POLLING_TIMEOUT', 30),
      limit: this.configService.get<number>('BOT_POLLING_LIMIT', 100),
      dropPendingUpdates: this.configService.get<boolean>('BOT_DROP_PENDING_UPDATES', false),
    };
  }
}
