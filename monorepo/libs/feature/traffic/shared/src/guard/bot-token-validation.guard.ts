import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { getErrorMessage } from '@app/common-shared';
import { BotTokenValidationService } from '../service';
import { BotTokenValidationDto } from '../dto';
import { botTokenOperationKey, optionalBotTokenKey, requiredBotTokenKey } from '../decorator';

/**
 * Bot Token Validation Guard
 *
 * Implements optional bot token validation for traffic operations
 * following existing auth patterns in the codebase
 */
@Injectable()
export class BotTokenValidationGuard implements CanActivate {
  private readonly logger = new Logger(BotTokenValidationGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly botTokenValidationService: BotTokenValidationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // Check if bot token validation is required or optional
    const isOptional = this.reflector.get<boolean>(optionalBotTokenKey, context.getHandler());

    const isRequired = this.reflector.get<boolean>(requiredBotTokenKey, context.getHandler());

    const operationContext = this.reflector.get<string>(botTokenOperationKey, context.getHandler());

    // Extract bot token from request
    const botToken = this.extractBotToken(request);

    // If no token and validation is optional, allow request
    if (!botToken && isOptional) {
      this.logger.debug('No bot token provided, but validation is optional');

      return true;
    }

    // If no token and validation is required, reject request
    if (!botToken && isRequired) {
      this.logger.warn('Bot token required but not provided');
      throw new UnauthorizedException('Bot token is required for this operation');
    }

    // If no token and validation is not explicitly configured, allow request
    if (!botToken && !isOptional && !isRequired) {
      return true;
    }

    // If token is provided, validate it
    if (botToken) {
      return this.validateBotToken(request, botToken, operationContext);
    }

    return true;
  }

  /**
   * Extract bot token from request
   */
  private extractBotToken(request: FastifyRequest): string | null {
    // Check multiple locations for bot token

    // 1. Authorization header with Bot scheme
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bot ')) {
      return authHeader.substring(4);
    }

    // 2. X-Bot-Token header
    const botTokenHeader = request.headers['x-bot-token'];
    if (botTokenHeader && typeof botTokenHeader === 'string') {
      return botTokenHeader;
    }

    // 3. Query parameter
    const query = request.query as Record<string, unknown> | undefined;
    const queryToken = query?.['bot_token'];
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    // 4. Request body (if present)
    const body = request.body as Record<string, unknown> | undefined;
    if (body?.['botToken'] && typeof body['botToken'] === 'string') {
      return body['botToken'];
    }

    return null;
  }

  /**
   * Validate bot token
   */
  private async validateBotToken(request: FastifyRequest, token: string, operationContext?: string): Promise<boolean> {
    try {
      const clientIp = this.getClientIp(request);

      const validationDto: BotTokenValidationDto = {
        token,
        operationContext,
      };

      const result = await this.botTokenValidationService.validateToken(validationDto, clientIp);

      if (result.err) {
        const error = result.val;
        this.logger.warn('Bot token validation failed', {
          error: error.message,
          clientIp,
          operationContext,
        });

        // Re-throw the specific error
        throw error;
      }

      const validationResponse = result.val;

      if (!validationResponse.isValid) {
        this.logger.warn('Bot token is invalid', {
          error: validationResponse.error,
          botId: validationResponse.botId,
          operationContext,
        });

        throw new UnauthorizedException(validationResponse.error || 'Invalid bot token');
      }

      // Add bot information to request for later use
      const botAuthRequest = request as BotAuthenticatedRequest;
      botAuthRequest.botAuth = {
        botId: validationResponse.botId ?? '',
        botUsername: validationResponse.botUsername,
        permissions: validationResponse.permissions || [],
        expiresAt: validationResponse.expiresAt,
        metadata: validationResponse.metadata,
      };

      this.logger.debug('Bot token validation successful', {
        botId: validationResponse.botId,
        botUsername: validationResponse.botUsername,
        operationContext,
      });

      return true;
    } catch (err: unknown) {
      // If it's already a known exception, re-throw it
      if (err instanceof UnauthorizedException) {
        throw err;
      }

      this.logger.error('Bot token validation error', {
        error: getErrorMessage(err),
        operationContext,
      });

      throw new UnauthorizedException('Bot token validation failed');
    }
  }

  /**
   * Get client IP address
   */
  private getClientIp(request: FastifyRequest): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded && typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }

    const realIp = request.headers['x-real-ip'];
    if (realIp && typeof realIp === 'string') {
      return realIp;
    }

    return request.ip || 'unknown';
  }
}

/**
 * Extended FastifyRequest with bot auth information
 */
export interface BotAuthenticatedRequest extends FastifyRequest {
  botAuth?: {
    botId: string;
    botUsername?: string;
    permissions: string[];
    expiresAt?: Date;
    metadata?: Record<string, unknown>;
  };
}
