import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { BotAuthenticatedRequest } from '../guard';

/**
 * Bot Token Validation Decorators
 *
 * Following the pattern from auth/shared decorators
 */

// Metadata keys
export const optionalBotTokenKey = 'bot_token:optional';
export const requiredBotTokenKey = 'bot_token:required';
export const botTokenOperationKey = 'bot_token:operation';

/**
 * Mark endpoint as requiring optional bot token validation
 */
export const OptionalBotToken = () => SetMetadata(optionalBotTokenKey, true);

/**
 * Mark endpoint as requiring mandatory bot token validation
 */
export const RequiredBotToken = () => SetMetadata(requiredBotTokenKey, true);

/**
 * Set operation context for bot token validation
 */
export const BotTokenOperation = (operation: string) => SetMetadata(botTokenOperationKey, operation);

/**
 * Get current bot authentication information from request
 *
 * Usage: getCurrentBotAuth(@CurrentBotAuth() botAuth)
 */
export const CurrentBotAuth = createParamDecorator(
  (
    data: string | undefined,
    ctx: ExecutionContext,
  ): {
    botId: string;
    botUsername?: string;
    permissions: string[];
    expiresAt?: Date;
    metadata?: Record<string, unknown>;
  } | null => {
    const request = ctx.switchToHttp().getRequest<BotAuthenticatedRequest>();
    const { botAuth } = request;

    if (!botAuth) {
      return null;
    }

    return data ? (botAuth[data as keyof typeof botAuth] as never) : botAuth;
  },
);

/**
 * Get current bot ID from request
 *
 * Usage: getBotId(@CurrentBotId() _botId: string)
 */
export const CurrentBotId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | null => {
  const request = ctx.switchToHttp().getRequest<BotAuthenticatedRequest>();

  return request.botAuth?.botId || null;
});

/**
 * Get current bot permissions from request
 *
 * Usage: getBotPermissions(@CurrentBotPermissions() permissions: string[])
 */
export const CurrentBotPermissions = createParamDecorator((_data: unknown, ctx: ExecutionContext): string[] => {
  const request = ctx.switchToHttp().getRequest<BotAuthenticatedRequest>();

  return request.botAuth?.permissions || [];
});

/**
 * Check if bot has specific permission
 *
 * Usage: @BotHasPermission('traffic_sell')
 */
export const BotHasPermission = (permission: string) =>
  createParamDecorator((_data: unknown, ctx: ExecutionContext): boolean => {
    const request = ctx.switchToHttp().getRequest<BotAuthenticatedRequest>();
    const permissions = request.botAuth?.permissions || [];

    return permissions.includes(permission);
  });

/**
 * Composite decorator for traffic sell operations
 *
 * Combines optional bot token validation with traffic_sell operation context
 */
export const TrafficSellAuth = () => {
  return function (target: Record<string, unknown>, propertyKey: string, descriptor: PropertyDescriptor) {
    // Apply multiple decorators
    OptionalBotToken()(target, propertyKey, descriptor);
    BotTokenOperation('traffic_sell')(target, propertyKey, descriptor);
  };
};

/**
 * Composite decorator for bot management operations
 *
 * Requires bot token validation for bot management operations
 */
export const BotManagementAuth = () => {
  return function (target: Record<string, unknown>, propertyKey: string, descriptor: PropertyDescriptor) {
    RequiredBotToken()(target, propertyKey, descriptor);
    BotTokenOperation('bot_management')(target, propertyKey, descriptor);
  };
};

/**
 * Composite decorator for traffic analytics operations
 *
 * Optional bot token validation for analytics operations
 */
export const TrafficAnalyticsAuth = () => {
  return function (target: Record<string, unknown>, propertyKey: string, descriptor: PropertyDescriptor) {
    OptionalBotToken()(target, propertyKey, descriptor);
    BotTokenOperation('traffic_analytics')(target, propertyKey, descriptor);
  };
};
