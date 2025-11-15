import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { InjectRedis, RedisClient } from '@app/common-redis';
import { Err, Ok, Result } from 'ts-results';
import { AsyncResult, getErrorMessage } from '@app/common-shared';
import { BadTokenException, InternalException, RateLimitExceedException } from '@app/common-exception';
import { BotFactoryService } from '@app/feature-bot-shared';
import { BotTokenValidationDto, BotTokenValidationResponseDto } from '../dto';
import {
  BotTokenExpiredException,
  BotTokenInvalidException,
  BotTokenRateLimitException,
  BotTokenServiceUnavailableException,
} from '../exception';

/**
 * Bot Token Validation Service
 *
 * Implements token validation following existing auth patterns
 * with integration to bot-shared feature for traffic operations
 */
@Injectable()
export class BotTokenValidationService {
  private readonly logger = new Logger(BotTokenValidationService.name);
  private readonly cachePrefix = 'bot_token_validation';
  private readonly rateLimitPrefix = 'bot_token_rate_limit';
  private readonly cacheExpiry = 300; // 5 minutes
  private readonly rateLimitWindow = 60; // 1 minute
  private readonly rateLimitMax = 100; // max requests per window

  constructor(
    @InjectRedis()
    private readonly redisClient: RedisClient,
    private readonly botTokenValidator: BotFactoryService,
  ) {}

  /**
   * Validate bot token with rate limiting and caching
   *
   * @param dto - Token validation data
   * @param clientIp - Client IP address for rate limiting
   * @returns Validation result
   */
  async validateToken(
    dto: BotTokenValidationDto,
    clientIp?: string,
  ): Promise<
    Result<
      BotTokenValidationResponseDto,
      | BotTokenExpiredException
      | BotTokenInvalidException
      | BotTokenServiceUnavailableException
      | BadTokenException
      | RateLimitExceedException
      | InternalException
    >
  > {
    try {
      // Check rate limiting
      const rateLimitResult = await this.checkRateLimitIfNeeded(clientIp);
      if (rateLimitResult) {
        return rateLimitResult;
      }

      // Check cache first
      const cachedResult = await this.getCachedValidation(dto.token);
      if (cachedResult) {
        return this.handleCacheHit(dto, cachedResult);
      }

      // Validate token format and extract bot ID
      const validationCheck = this.validateTokenFormatAndExtractBotId(dto);
      if (validationCheck.err) {
        return validationCheck;
      }

      // Perform actual token validation
      const validationResult = await this.performTokenValidation(dto);

      // Handle validation result
      return this.handleValidationResult(dto, validationResult);
    } catch (err: unknown) {
      return this.handleValidationError(err, dto, clientIp);
    }
  }

  /**
   * Validate token without caching (for testing or direct validation)
   * Complexity reduced by extracting validation logic
   *
   * @param dto - Token validation data
   * @returns Direct validation result
   */
  async validateTokenDirect(dto: BotTokenValidationDto): Promise<BotTokenValidationResponseDto> {
    const formatValidation = this.validateTokenFormat(dto.token);
    if (!formatValidation) {
      return {
        isValid: false,
        error: 'Invalid token format',
      };
    }

    return this.performTokenValidation(dto);
  }

  /**
   * Check if operation requires token validation
   *
   * @param operationContext - Operation context
   * @returns True if token validation is required
   */
  isTokenValidationRequired(operationContext?: string): boolean {
    // Define operations that require token validation
    const requiresValidation = ['traffic_sell', 'bot_management', 'traffic_analytics'];

    if (!operationContext) {
      return false;
    }

    return requiresValidation.includes(operationContext);
  }

  /**
   * Get bot permissions for traffic operations
   * Validates botId format before processing
   *
   * @param botId - Bot ID
   * @returns List of permissions
   */
  async getBotPermissions(botId: string): Promise<string[]> {
    try {
      // Validate botId format (must be numeric)
      if (!botId || !/^\d+$/.test(botId)) {
        this.logger.warn('Invalid botId format in getBotPermissions', {
          botId,
        });
        return [];
      }

      // This would integrate with bot-shared feature to get actual permissions
      // For now, return default permissions based on bot status
      const cacheKey = `${this.cachePrefix}:permissions:${botId}`;
      const cached = await this.redisClient.get(cacheKey);

      if (cached) {
        return JSON.parse(cached) as string[];
      }

      // Default permissions for traffic operations
      const permissions = ['traffic_sell', 'traffic_stats', 'bot_management'];

      // Cache permissions for 10 minutes
      await this.redisClient.set(cacheKey, JSON.stringify(permissions), 'EX', 600);

      return permissions;
    } catch (err: unknown) {
      this.logger.warn('Failed to get bot permissions', {
        botId,
        error: getErrorMessage(err),
      });

      return []; // Return empty permissions on error
    }
  }

  /**
   * Invalidate cached token validation
   * Parallelizes Redis operations for better performance
   *
   * @param token - Token to invalidate
   */
  async invalidateToken(token: string): Promise<void> {
    try {
      const cacheKey = `${this.cachePrefix}:${this.hashToken(token)}`;
      const botId = this.extractBotId(token);

      // Parallelize Redis delete operations
      const deleteOperations = [this.redisClient.del(cacheKey)];

      if (botId) {
        const permissionsCacheKey = `${this.cachePrefix}:permissions:${botId}`;
        deleteOperations.push(this.redisClient.del(permissionsCacheKey));
      }

      await Promise.all(deleteOperations);

      this.logger.debug('Token validation cache invalidated', {
        botId,
      });
    } catch (err: unknown) {
      this.logger.warn('Failed to invalidate token cache', {
        error: getErrorMessage(err),
      });
    }
  }

  /**
   * Check rate limit if client IP is provided
   */
  private async checkRateLimitIfNeeded(
    clientIp?: string,
  ): Promise<
    | Result<
        BotTokenValidationResponseDto,
        | BotTokenExpiredException
        | BotTokenInvalidException
        | BotTokenServiceUnavailableException
        | BadTokenException
        | RateLimitExceedException
        | InternalException
      >
    | undefined
  > {
    if (!clientIp) {
      return undefined;
    }

    const rateLimitCheck = await this.checkRateLimit(clientIp);
    if (rateLimitCheck.err) {
      return rateLimitCheck as Result<
        BotTokenValidationResponseDto,
        | BotTokenExpiredException
        | BotTokenInvalidException
        | BotTokenServiceUnavailableException
        | BadTokenException
        | RateLimitExceedException
        | InternalException
      >;
    }

    return undefined;
  }

  /**
   * Handle cache hit
   */
  private handleCacheHit(
    dto: BotTokenValidationDto,
    cachedResult: BotTokenValidationResponseDto,
  ): Result<
    BotTokenValidationResponseDto,
    | BotTokenExpiredException
    | BotTokenInvalidException
    | BotTokenServiceUnavailableException
    | BadTokenException
    | RateLimitExceedException
    | InternalException
  > {
    this.logger.debug('Token validation cache hit', {
      botId: this.extractBotId(dto.token),
      operationContext: dto.operationContext,
    });

    return Ok(cachedResult);
  }

  /**
   * Validate token format and extract bot ID
   */
  private validateTokenFormatAndExtractBotId(dto: BotTokenValidationDto): Result<string, BotTokenInvalidException> {
    const formatValidation = this.validateTokenFormat(dto.token);
    if (!formatValidation) {
      this.logger.warn('Invalid token format', {
        token: this.maskToken(dto.token),
        operationContext: dto.operationContext,
        correlationId: this.generateCorrelationId(),
      });

      return Err(new BotTokenInvalidException('Invalid token format'));
    }

    const botId = this.extractBotId(dto.token);
    if (!botId) {
      this.logger.warn('Failed to extract bot ID', {
        token: this.maskToken(dto.token),
        operationContext: dto.operationContext,
        correlationId: this.generateCorrelationId(),
      });

      return Err(new BotTokenInvalidException('Unable to extract bot ID from token'));
    }

    return Ok(botId);
  }

  /**
   * Handle validation result with caching and logging
   */
  private async handleValidationResult(
    dto: BotTokenValidationDto,
    validationResult: BotTokenValidationResponseDto,
  ): Promise<
    Result<
      BotTokenValidationResponseDto,
      | BotTokenExpiredException
      | BotTokenInvalidException
      | BotTokenServiceUnavailableException
      | BadTokenException
      | RateLimitExceedException
      | InternalException
    >
  > {
    const botId = this.extractBotId(dto.token);

    if (validationResult.isValid) {
      await this.cacheValidationResult(dto.token, validationResult);
      this.logger.debug('Token validation successful', {
        botId,
        operationContext: dto.operationContext,
        correlationId: this.generateCorrelationId(),
      });
    } else {
      this.logger.warn('Token validation failed', {
        botId,
        error: validationResult.error,
        operationContext: dto.operationContext,
        correlationId: this.generateCorrelationId(),
      });
    }

    return Ok(validationResult);
  }

  /**
   * Handle validation errors
   * Checks error type and properties to determine appropriate response
   */
  private handleValidationError(
    err: unknown,
    dto: BotTokenValidationDto,
    clientIp?: string,
  ): Result<
    BotTokenValidationResponseDto,
    | BotTokenExpiredException
    | BotTokenInvalidException
    | BotTokenServiceUnavailableException
    | BadTokenException
    | RateLimitExceedException
    | InternalException
  > {
    const correlationId = this.generateCorrelationId();
    const errorMessage = getErrorMessage(err);

    this.logger.error('Token validation critical error', {
      error: errorMessage,
      stack: err instanceof Error ? err.stack : undefined,
      operationContext: dto.operationContext,
      correlationId,
      botId: this.extractBotId(dto.token),
      clientIp: clientIp || 'unknown',
      timestamp: new Date().toISOString(),
    });

    // Check if error is from BotFactoryService or network-related
    if (
      err instanceof Error &&
      (err.name === 'ServiceUnavailableError' ||
        err.message.toLowerCase().includes('network') ||
        err.message.toLowerCase().includes('timeout') ||
        err.message.toLowerCase().includes('econnrefused'))
    ) {
      return Err(new BotTokenServiceUnavailableException('Bot validation service is temporarily unavailable'));
    }

    return Err(new InternalException({ detail: 'Token validation failed' }));
  }

  /**
   * Check rate limiting for IP address
   */
  private async checkRateLimit(
    clientIp: string,
  ): AsyncResult<void, RateLimitExceedException | BotTokenRateLimitException> {
    try {
      const rateLimitKey = `${this.rateLimitPrefix}:${clientIp}`;
      const current = await this.redisClient.incr(rateLimitKey);

      if (current === 1) {
        await this.redisClient.expire(rateLimitKey, this.rateLimitWindow);
      }

      if (current > this.rateLimitMax) {
        const ttl = await this.redisClient.ttl(rateLimitKey);
        this.logger.warn('Bot token validation rate limit exceeded', {
          clientIp,
          current,
          ttl,
          rateLimitMax: this.rateLimitMax,
          correlationId: this.generateCorrelationId(),
        });

        return Err(new BotTokenRateLimitException(ttl, `Rate limit exceeded. Try again in ${ttl} seconds`));
      }

      return Ok(undefined);
    } catch (err: unknown) {
      this.logger.error('Rate limit check failed', {
        clientIp,
        error: getErrorMessage(err),
        correlationId: this.generateCorrelationId(),
      });

      return Ok(undefined); // Allow request if rate limit check fails
    }
  }

  /**
   * Get cached validation result
   */
  private async getCachedValidation(token: string): Promise<BotTokenValidationResponseDto | null> {
    try {
      const cacheKey = `${this.cachePrefix}:${this.hashToken(token)}`;
      const cached = await this.redisClient.get(cacheKey);

      if (cached) {
        return JSON.parse(cached) as BotTokenValidationResponseDto;
      }

      return null;
    } catch (err: unknown) {
      this.logger.warn('Failed to get cached validation', {
        error: getErrorMessage(err),
      });

      return null;
    }
  }

  /**
   * Cache validation result
   */
  private async cacheValidationResult(token: string, result: BotTokenValidationResponseDto): Promise<void> {
    try {
      if (result.isValid) {
        const cacheKey = `${this.cachePrefix}:${this.hashToken(token)}`;
        await this.redisClient.set(cacheKey, JSON.stringify(result), 'EX', this.cacheExpiry);
      }
    } catch (err: unknown) {
      this.logger.warn('Failed to cache validation result', {
        error: getErrorMessage(err),
      });
    }
  }

  /**
   * Perform actual token validation
   * Integrates with bot-shared feature for real Telegram API validation
   */
  private async performTokenValidation(dto: BotTokenValidationDto): Promise<BotTokenValidationResponseDto> {
    const botId = this.extractBotId(dto.token);

    try {
      // Validate token via Telegram API using bot-shared service
      const validationResult = await this.botTokenValidator.validateBotToken(dto.token);

      if (!validationResult.isValid) {
        return {
          isValid: false,
          error: validationResult.error || 'Invalid or expired token',
        };
      }

      // Get bot permissions for traffic operations
      const permissions = await this.getBotPermissions(botId);

      // Use real bot info from Telegram API
      const botUsername = validationResult.botInfo?.username
        ? `@${validationResult.botInfo.username}`
        : `@bot_${botId}`;

      return {
        isValid: true,
        botId,
        botUsername,
        permissions,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        metadata: {
          rateLimit: {
            remaining: this.rateLimitMax - 1,
            resetAt: new Date(Date.now() + this.rateLimitWindow * 1000),
          },
          validatedAt: new Date(),
          operationContext: dto.operationContext,
          telegramBotInfo: {
            id: validationResult.botInfo?.id,
            firstName: validationResult.botInfo?.firstName,
            canJoinGroups: validationResult.botInfo?.canJoinGroups,
            canReadAllGroupMessages: validationResult.botInfo?.canReadAllGroupMessages,
            supportsInlineQueries: validationResult.botInfo?.supportsInlineQueries,
          },
        },
      };
    } catch (err: unknown) {
      this.logger.error('Token validation with bot-shared failed', {
        botId,
        error: getErrorMessage(err),
      });

      return {
        isValid: false,
        error: 'Token validation service unavailable',
      };
    }
  }

  /**
   * Validate token format
   */
  private validateTokenFormat(token: string): boolean {
    const tokenRegex = /^\d+:[A-Za-z0-9_-]{35}$/;

    return tokenRegex.test(token);
  }

  /**
   * Extract bot ID from token
   */
  private extractBotId(token: string): string {
    const parts = token.split(':');

    return parts[0] || '';
  }

  /**
   * Create a secure hash of the token for caching
   * Uses SHA-256 to safely store token references in cache keys
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Mask token for logging (security)
   */
  private maskToken(token: string): string {
    const parts = token.split(':');
    if (parts.length !== 2) {
      return '***';
    }

    return `${parts[0]}:${parts[1].substring(0, 4)}***`;
  }

  /**
   * Generate correlation ID for request tracking using crypto
   */
  private generateCorrelationId(): string {
    return `bot-token-${randomUUID()}`;
  }
}
