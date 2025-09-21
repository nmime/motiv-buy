import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Bot Token Validation Exceptions
 *
 * Custom exceptions for bot token validation following existing patterns
 */

/**
 * Bot Token Expired Exception
 */
export class BotTokenExpiredException extends HttpException {
  constructor(message = 'Bot token has expired') {
    super(
      {
        error: 'BOT_TOKEN_EXPIRED',
        message,
        statusCode: HttpStatus.UNAUTHORIZED,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * Bot Token Invalid Exception
 */
export class BotTokenInvalidException extends HttpException {
  constructor(message = 'Invalid bot token') {
    super(
      {
        error: 'BOT_TOKEN_INVALID',
        message,
        statusCode: HttpStatus.UNAUTHORIZED,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * Bot Token Insufficient Permissions Exception
 */
export class BotTokenInsufficientPermissionsException extends HttpException {
  constructor(requiredPermissions: string[] = [], message?: string) {
    const defaultMessage = `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`;
    super(
      {
        error: 'BOT_TOKEN_INSUFFICIENT_PERMISSIONS',
        message: message || defaultMessage,
        statusCode: HttpStatus.FORBIDDEN,
        requiredPermissions,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

/**
 * Bot Token Service Unavailable Exception
 */
export class BotTokenServiceUnavailableException extends HttpException {
  constructor(message = 'Bot token validation service is temporarily unavailable') {
    super(
      {
        error: 'BOT_TOKEN_SERVICE_UNAVAILABLE',
        message,
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/**
 * Bot Token Rate Limit Exceeded Exception
 */
export class BotTokenRateLimitException extends HttpException {
  constructor(retryAfter = 60, message = 'Bot token validation rate limit exceeded') {
    super(
      {
        error: 'BOT_TOKEN_RATE_LIMIT_EXCEEDED',
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
    const defaultMessage = `Bot '${botId}' is suspended${reason ? `: ${reason}` : ''}`;
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
