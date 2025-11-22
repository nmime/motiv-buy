import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Telegram Bot Token Validation Exceptions
 *
 * Custom exceptions for Telegram bot token validation following existing patterns
 */

/**
 * Telegram Bot Token Expired Exception
 */
export class TelegramBotTokenExpiredException extends HttpException {
  constructor(message = 'Telegram bot token has expired') {
    super(
      {
        error: 'TELEGRAM_BOT_TOKEN_EXPIRED',
        message,
        statusCode: HttpStatus.UNAUTHORIZED,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * Telegram Bot Token Invalid Exception
 */
export class TelegramBotTokenInvalidException extends HttpException {
  constructor(message = 'Invalid Telegram bot token') {
    super(
      {
        error: 'TELEGRAM_BOT_TOKEN_INVALID',
        message,
        statusCode: HttpStatus.UNAUTHORIZED,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * Telegram Bot Token Insufficient Permissions Exception
 */
export class TelegramBotTokenInsufficientPermissionsException extends HttpException {
  constructor(requiredPermissions: string[] = [], message?: string) {
    const defaultMessage = `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`;
    super(
      {
        error: 'TELEGRAM_BOT_TOKEN_INSUFFICIENT_PERMISSIONS',
        message: message || defaultMessage,
        statusCode: HttpStatus.FORBIDDEN,
        requiredPermissions,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

/**
 * Telegram Bot Token Service Unavailable Exception
 */
export class TelegramBotTokenServiceUnavailableException extends HttpException {
  constructor(message = 'Telegram bot token validation service is temporarily unavailable') {
    super(
      {
        error: 'TELEGRAM_BOT_TOKEN_SERVICE_UNAVAILABLE',
        message,
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/**
 * Telegram Bot Token Rate Limit Exceeded Exception
 */
export class TelegramBotTokenRateLimitException extends HttpException {
  constructor(retryAfter = 60, message = 'Telegram bot token validation rate limit exceeded') {
    super(
      {
        error: 'TELEGRAM_BOT_TOKEN_RATE_LIMIT_EXCEEDED',
        message,
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        retryAfter,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * Bot Not Found Exception
 */
export class BotNotFoundException extends HttpException {
  constructor(botId: string, message?: string) {
    const defaultMessage = `Bot with ID '${botId}' not found`;
    super(
      {
        error: 'BOT_NOT_FOUND',
        message: message || defaultMessage,
        statusCode: HttpStatus.NOT_FOUND,
        botId,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

/**
 * Bot Suspended Exception
 */
export class BotSuspendedException extends HttpException {
  constructor(botId: string, reason?: string, message?: string) {
    const suspensionReason = reason ? ': ' + reason : '';
    const defaultMessage = `Bot '${botId}' is suspended${suspensionReason}`;
    super(
      {
        error: 'BOT_SUSPENDED',
        message: message || defaultMessage,
        statusCode: HttpStatus.FORBIDDEN,
        botId,
        reason,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
