import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

/**
 * API Key Guard for Public Traffic Source API
 * Validates API key from header or query parameter
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // Extract API key from request
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      this.logger.warn('API key missing in request');
      throw new UnauthorizedException('API key is required');
    }

    // Store API key in request for later use
    const apiKeyRequest = request as ApiKeyAuthenticatedRequest;
    apiKeyRequest.apiKey = apiKey;

    return true;
  }

  /**
   * Extract API key from request
   * Checks: X-API-Key header, api_key query parameter, Authorization: Bearer
   */
  private extractApiKey(request: FastifyRequest): string | null {
    // 1. X-API-Key header
    const apiKeyHeader = request.headers['x-api-key'];

    if (apiKeyHeader && typeof apiKeyHeader === 'string') {
      return apiKeyHeader;
    }

    // 2. Authorization: Bearer header
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 3. Query parameter
    const query = request.query as Record<string, unknown> | undefined;
    const queryApiKey = query?.['api_key'];

    if (queryApiKey && typeof queryApiKey === 'string') {
      return queryApiKey;
    }

    return null;
  }
}

/**
 * Extended FastifyRequest with API key information
 */
export interface ApiKeyAuthenticatedRequest extends FastifyRequest {
  apiKey: string;
}
