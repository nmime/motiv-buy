import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis, RedisClient } from '@app/common-redis';
import { Err, Ok, Result } from 'ts-results';
import {
  BadTokenException,
  RateLimitExceedException,
  InternalException,
} from '@app/common-exception';
import { BotTokenValidationDto, BotTokenValidationResponseDto } from '../dto';
import {
  BotTokenExpiredException,
  BotTokenInvalidException,
  BotTokenServiceUnavailableException,
  BotTokenRateLimitException,
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
      | BadTokenException
      | RateLimitExceedException
      | InternalException
      | BotTokenInvalidException
      | BotTokenExpiredException
      | BotTokenServiceUnavailableException
    >
  > {
    try {
      // Check rate limiting
      if (clientIp) {
        const rateLimitCheck = await this.checkRateLimit(clientIp);
        if (rateLimitCheck.err) {
          return rateLimitCheck as Result<BotTokenValidationResponseDto, BotTokenExpiredException | BotTokenInvalidException | BotTokenServiceUnavailableException | BadTokenException | RateLimitExceedException | InternalException>;
        }
      }

      // Check cache first
      const cachedResult = await this.getCachedValidation(dto.token);
      if (cachedResult) {
        this.logger.debug('Token validation cache hit', {
          botId: this.extractBotId(dto.token),
          operationContext: dto.operationContext,
        });

        return Ok(cachedResult);
      }

      // Validate token format
      const formatValidation = this.validateTokenFormat(dto.token);
      if (!formatValidation) {
        const error = new BotTokenInvalidException('Invalid token format');
        this.logger.warn('Invalid token format', {
          token: this.maskToken(dto.token),
          operationContext: dto.operationContext,
          correlationId: this.generateCorrelationId(),
        });

        return Err(error);
      }

      // Extract bot ID from token
      const botId = this.extractBotId(dto.token);
      if (!botId) {
        const error = new BotTokenInvalidException('Unable to extract bot ID from token');
        this.logger.warn('Failed to extract bot ID', {
          token: this.maskToken(dto.token),
          operationContext: dto.operationContext,
          correlationId: this.generateCorrelationId(),
        });

        return Err(error);
      }

      // Perform actual token validation
      const validationResult = await this.performTokenValidation(dto);

      // Cache valid results
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
    } catch (error) {
      const correlationId = this.generateCorrelationId();

      // Enhanced error logging with structured data
      this.logger.error('Token validation critical error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operationContext: dto.operationContext,
        correlationId,
        botId: this.extractBotId(dto.token),
        clientIp: clientIp || 'unknown',
        timestamp: new Date().toISOString(),
      });

      // Check if it's a specific service error
      if (error instanceof Error && error.message.includes('bot-shared')) {
        return Err(new BotTokenServiceUnavailableException('Bot validation service is temporarily unavailable'));
      }

      return Err(new InternalException({ detail: 'Token validation failed' }));
    }
  }

  /**
   * Validate token without caching (for testing or direct validation)
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
   *
   * @param botId - Bot ID
   * @returns List of permissions
   */
  async getBotPermissions(botId: string): Promise<string[]> {
    try {
      // This would integrate with bot-shared feature to get actual permissions
      // For now, return default permissions based on bot status
      const cacheKey = `${this.cachePrefix}:permissions:${botId}`;
      const cached = await this.redisClient.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Default permissions for traffic operations
      const permissions = ['traffic_sell', 'traffic_stats', 'bot_management'];

      // Cache permissions for 10 minutes
      await this.redisClient.set(cacheKey, JSON.stringify(permissions), 'EX', 600);

      return permissions;
    } catch (error) {
      this.logger.warn('Failed to get bot permissions', {
        botId,
        error: error instanceof Error ? error.message : String(error),
      });

      return []; // Return empty permissions on error
    }
  }

  /**
   * Invalidate cached token validation
   *
   * @param token - Token to invalidate
   */
  async invalidateToken(token: string): Promise<void> {
    try {
      const cacheKey = `${this.cachePrefix}:${this.hashToken(token)}`;
      await this.redisClient.del(cacheKey);

      const botId = this.extractBotId(token);
      if (botId) {
        const permissionsCacheKey = `${this.cachePrefix}:permissions:${botId}`;
        await this.redisClient.del(permissionsCacheKey);
      }

      this.logger.debug('Token validation cache invalidated', {
        botId: this.extractBotId(token),
      });
    } catch (error) {
      this.logger.warn('Failed to invalidate token cache', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check rate limiting for IP address
   */
  private async checkRateLimit(
    clientIp: string,
  ): Promise<Result<void, RateLimitExceedException | BotTokenRateLimitException>> {
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
    } catch (error) {
      this.logger.error('Rate limit check failed', {
        clientIp,
        error: error instanceof Error ? error.message : String(error),
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
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      this.logger.warn('Failed to get cached validation', {
        error: error instanceof Error ? error.message : String(error),
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
    } catch (error) {
      this.logger.warn('Failed to cache validation result', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Perform actual token validation
   * This would integrate with bot-shared feature for real validation
   */
  private async performTokenValidation(dto: BotTokenValidationDto): Promise<BotTokenValidationResponseDto> {
    const botId = this.extractBotId(dto.token);

    // This is where you would integrate with bot-shared feature
    // For now, implement basic validation logic

    try {
      // Simulate bot-shared integration
      const isValid = await this.validateWithBotShared(dto.token, dto.operationContext);

      if (!isValid) {
        return {
          isValid: false,
          error: 'Invalid or expired token',
        };
      }

      // Get bot permissions for traffic operations
      const permissions = await this.getBotPermissions(botId);

      return {
        isValid: true,
        botId,
        botUsername: `@bot_${botId}`, // This would come from bot-shared
        permissions,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        metadata: {
          rateLimit: {
            remaining: this.rateLimitMax - 1,
            resetAt: new Date(Date.now() + this.rateLimitWindow * 1000),
          },
          validatedAt: new Date(),
          operationContext: dto.operationContext,
        },
      };
    } catch (error) {
      this.logger.error('Token validation with bot-shared failed', {
        botId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isValid: false,
        error: 'Token validation service unavailable',
      };
    }
  }

  /**
   * Validate with bot-shared feature (placeholder for integration)
   */
  private async validateWithBotShared(token: string, _operationContext?: string): Promise<boolean> {
    // TODO: Integrate with actual bot-shared feature
    // This is a placeholder that simulates validation

    // Basic checks that would be done by bot-shared
    const botId = this.extractBotId(token);
    if (!botId) {
      return false;
    }

    // Simulate async validation
    await new Promise((resolve) => setTimeout(resolve, 10));

    // For demo purposes, consider tokens valid if they follow correct format
    // and botId is numeric
    return /^\d+$/.test(botId);
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
   * Create a hash of the token for caching (secure)
   */
  private hashToken(token: string): string {
    // Simple hash for demo - in production, use proper crypto
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString();
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
   * Generate correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `bot-token-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}
