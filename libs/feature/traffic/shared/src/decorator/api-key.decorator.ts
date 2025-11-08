import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiKeyAuthenticatedRequest } from '../guard/api-key.guard';

/**
 * Decorator to extract API key from authenticated request
 * Usage: getApiKey(@ApiKey() apiKey: string)
 */
export const ApiKey = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<ApiKeyAuthenticatedRequest>();

  return request.apiKey;
});
