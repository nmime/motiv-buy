import { Injectable, Logger } from '@nestjs/common';
import { Bot } from 'grammy';
import { BotInstanceInfo, BotInstanceOptions, BotSessionContext, BotValidationResult } from './bot-factory.types';

/**
 * Bot Factory Service
 *
 * Factory service for creating and managing Grammy bot instances.
 * Supports creating bots with/without tokens and validating bot tokens.
 *
 * @class BotFactoryService
 */
@Injectable()
export class BotFactoryService {
  private readonly logger = new Logger(BotFactoryService.name);

  /**
   * Create a new bot instance with authentication token
   *
   * @param token - Bot token from BotFather
   * @param options - Bot instance options
   * @returns Configured bot instance
   *
   * @example
   * const bot = botFactory.createBot('123456:ABC-DEF', {
   *   enableSession: true,
   *   enableRetry: true,
   *   apiTimeout: 5000
   * });
   */
  createBot(token: string, options: BotInstanceOptions = {}): Bot<BotSessionContext> {
    this.logger.log('Creating authenticated bot instance');

    if (!token || token.trim().length === 0) {
      throw new Error('Bot token is required');
    }

    const botConfig = {
      client: {
        timeoutSeconds: options.apiTimeout ? options.apiTimeout / 1000 : 30,
        ...(options.apiRoot && { apiRoot: options.apiRoot }),
      },
    };

    const bot = new Bot<BotSessionContext>(token, botConfig) as Bot<BotSessionContext>;

    // Apply middleware based on options
    this.applyMiddleware(bot, options);

    this.logger.log('Authenticated bot instance created successfully');

    return bot;
  }

  /**
   * Create a bot instance without authentication
   *
   * Useful for testing or scenarios where you need a bot structure
   * but won't be making actual API calls.
   *
   * @param options - Bot instance options
   * @returns Bot instance (API calls will fail without valid token)
   *
   * @example
   * const mockBot = botFactory.createUnauthenticatedBot();
   */
  createUnauthenticatedBot(options: BotInstanceOptions = {}): Bot<BotSessionContext> {
    this.logger.warn('Creating UNAUTHENTICATED bot instance - API calls will fail');

    // Create bot with a dummy token
    // This will work for local testing but fail on actual API calls
    const dummyToken = 'UNAUTHENTICATED';
    const bot = new Bot<BotSessionContext>(dummyToken);

    this.applyMiddleware(bot, options);

    this.logger.log('Unauthenticated bot instance created');

    return bot;
  }

  /**
   * Validate a bot token by calling the Telegram getMe API
   *
   * This makes an actual API call to verify the token is valid
   * and retrieves bot information.
   *
   * @param token - Bot token to validate
   * @returns Validation result with bot information
   *
   * @example
   * const result = await botFactory.validateBotToken('123456:ABC-DEF');
   * if (result.isValid) {
   *   console.log('Bot username:', result.botInfo?.username);
   * }
   */
  async validateBotToken(token: string): Promise<BotValidationResult> {
    this.logger.log('Validating bot token...');

    if (!token || token.trim().length === 0) {
      return {
        isValid: false,
        error: 'Bot token is empty or undefined',
        errorCode: 'EMPTY_TOKEN',
        timestamp: new Date(),
      };
    }

    try {
      // Create a temporary bot instance for validation
      const tempBot = new Bot(token);

      // Call getMe to validate token and get bot info
      const me = await tempBot.api.getMe();

      const botInfo: BotInstanceInfo = {
        id: me.id,
        username: me.username,
        firstName: me.first_name,
        isBot: me.is_bot,
        canJoinGroups: me.can_join_groups,
        canReadAllGroupMessages: me.can_read_all_group_messages,
        supportsInlineQueries: me.supports_inline_queries,
        canConnectToBusiness: me.can_connect_to_business,
      };

      this.logger.log(`Bot token validated successfully: @${botInfo.username}`);

      return {
        isValid: true,
        botInfo,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = this.extractErrorCode(error);

      this.logger.error(`Bot token validation failed: ${errorMessage}`, error);

      return {
        isValid: false,
        error: errorMessage,
        errorCode,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get bot information using the getMe API
   *
   * @param bot - Bot instance
   * @returns Bot information
   *
   * @example
   * const bot = botFactory.createBot(token);
   * const info = await botFactory.getBotInfo(bot);
   * console.log('Bot ID:', info.id);
   */
  async getBotInfo(bot: Bot<BotSessionContext>): Promise<BotInstanceInfo> {
    this.logger.log('Retrieving bot information...');

    try {
      const me = await bot.api.getMe();

      const botInfo: BotInstanceInfo = {
        id: me.id,
        username: me.username,
        firstName: me.first_name,
        isBot: me.is_bot,
        canJoinGroups: me.can_join_groups,
        canReadAllGroupMessages: me.can_read_all_group_messages,
        supportsInlineQueries: me.supports_inline_queries,
        canConnectToBusiness: me.can_connect_to_business,
      };

      this.logger.log(`Bot info retrieved: @${botInfo.username} (ID: ${botInfo.id})`);

      return botInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to retrieve bot info: ${errorMessage}`, error);
      throw new Error(`Failed to retrieve bot information: ${errorMessage}`);
    }
  }

  /**
   * Apply middleware to bot instance based on options
   *
   * @private
   * @param bot - Bot instance
   * @param options - Bot instance options
   */
  private applyMiddleware(bot: Bot<BotSessionContext>, _options: BotInstanceOptions): void {
    // Session middleware is handled by the consuming application
    // since it requires specific session storage configuration

    // Add basic error handling
    bot.catch((err) => {
      const error = err.error as Error;
      this.logger.error('Bot error occurred:', {
        error: error.message,
        stack: error.stack,
      });
    });

    this.logger.debug('Middleware applied to bot instance');
  }

  /**
   * Validate bot username format and basic checks
   *
   * Note: This validates the username format but cannot verify if the bot exists
   * without making authenticated API calls. For traffic source creation without token,
   * this provides basic validation and the actual existence check happens during
   * manual moderation.
   *
   * @param username - Bot username (with or without @)
   * @returns Validation result
   *
   * @example
   * const result = await botFactory.validateBotUsername('@mybot');
   * if (result.isValid) {
   *   console.log('Valid username format');
   * }
   */
  async validateBotUsername(username: string): Promise<{
    isValid: boolean;
    botId?: number;
    username?: string;
    error?: string;
  }> {
    this.logger.log(`Validating bot username: ${username}`);

    if (!username || username.trim().length === 0) {
      return {
        isValid: false,
        error: 'Username is empty or undefined',
      };
    }

    // Remove @ if present
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;

    // Validate username format
    // Telegram usernames: 5-32 characters, alphanumeric and underscores only, must end with 'bot' (case insensitive)
    const usernameRegex = /^\w{5,32}$/;
    const botSuffixRegex = /bot$/i;

    if (!usernameRegex.test(cleanUsername)) {
      return {
        isValid: false,
        error: 'Invalid username format. Must be 5-32 characters, alphanumeric and underscores only',
      };
    }

    if (!botSuffixRegex.test(cleanUsername)) {
      return {
        isValid: false,
        error: 'Bot username must end with "bot"',
      };
    }

    // NOTE: Without a bot token or API access, we cannot verify if the bot actually exists
    // This will be verified during manual moderation for WITHOUT token flow
    this.logger.log(`Bot username format validated: @${cleanUsername}`);

    return {
      isValid: true,
      username: cleanUsername,
    };
  }

  /**
   * Extract error code from Telegram API error
   *
   * @private
   * @param error - Error object
   * @returns Error code string
   */
  private extractErrorCode(error: unknown): string {
    if (error && typeof error === 'object' && 'error_code' in error) {
      return String(error.error_code);
    }

    if (!(error instanceof Error)) {
      return 'UNKNOWN_ERROR';
    }

    // Extract error code from message if present
    const match = error.message.match(/(\d{3})/);
    if (match) {
      return match[1];
    }

    // Common error patterns
    const errorPatterns: Record<string, string> = {
      'Unauthorized': '401',
      'Not Found': '404',
      'Bad Request': '400',
      'Forbidden': '403',
      'Too Many Requests': '429',
      'timeout': 'TIMEOUT',
      'network': 'NETWORK_ERROR',
    };

    for (const [pattern, code] of Object.entries(errorPatterns)) {
      if (error.message.includes(pattern)) {
        return code;
      }
    }

    return 'UNKNOWN_ERROR';
  }
}
