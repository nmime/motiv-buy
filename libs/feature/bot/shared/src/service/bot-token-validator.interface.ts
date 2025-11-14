import { BotValidationResult } from './bot-factory.interface';

/**
 * Bot Token Validator Interface
 *
 * Interface for validating bot tokens via Telegram API
 * Used by traffic-shared to validate bot tokens without circular dependency
 */
export interface IBotTokenValidator {
  /**
   * Validate a bot token by calling Telegram getMe API
   *
   * @param token - Bot token to validate
   * @returns Validation result with bot information
   */
  validateBotToken(token: string): Promise<BotValidationResult>;

  /**
   * Validate bot username by checking if bot exists
   * Note: This requires making requests to Telegram API
   *
   * @param username - Bot username (with or without @)
   * @returns True if bot exists and is valid
   */
  validateBotUsername(username: string): Promise<{
    isValid: boolean;
    botId?: number;
    username?: string;
    error?: string;
  }>;
}
