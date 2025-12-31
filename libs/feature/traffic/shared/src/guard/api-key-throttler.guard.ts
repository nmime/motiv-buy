import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { FastifyRequest } from 'fastify';

/**
 * API Key Throttler Guard
 *
 * Provides per-API-key rate limiting for public API endpoints.
 * Extends ThrottlerGuard to use API key from X-API-Key header as the tracking identifier.
 *
 * For requests with an API key: Rate limiting is applied per API key
 * For requests without an API key: Falls back to IP-based rate limiting
 *
 * @example
 * ```typescript
 * @UseGuards(ApiKeyThrottlerGuard)
 * @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute per API key
 * export class TrafficSourcePublicController {
 *   // ...
 * }
 * ```
 */
@Injectable()
export class ApiKeyThrottlerGuard extends ThrottlerGuard {
  /**
   * Get tracker identifier for rate limiting
   *
   * Priority:
   * 1. API key from X-API-Key header (if present)
   * 2. API key from Authorization: Bearer header (if present)
   * 3. Cloudflare connecting IP
   * 4. X-Real-IP header
   * 5. Request IP
   *
   * @param req - Fastify request object
   * @returns Unique identifier for rate limiting
   */
  protected override async getTracker(req: FastifyRequest): Promise<string> {
    // Extract API key from header
    const apiKey = this.extractApiKey(req);

    if (apiKey) {
      // Use API key as primary tracker for authenticated requests
      return `api-key:${apiKey}`;
    }

    // Fallback to IP-based tracking for requests without API key
    const ip =
      (req.headers['cf-connecting-ip'] as string) ??
      (req.headers['x-real-ip'] as string) ??
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip ??
      'unknown';

    return `ip:${ip}`;
  }

  /**
   * Extract API key from request headers
   */
  private extractApiKey(req: FastifyRequest): string | null {
    // 1. X-API-Key header
    const apiKeyHeader = req.headers['x-api-key'];
    if (apiKeyHeader && typeof apiKeyHeader === 'string') {
      return apiKeyHeader;
    }

    // 2. Authorization: Bearer header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  /**
   * Throw custom throttling exception
   *
   * Provides a clear error message for rate-limited requests
   *
   * @param context - Execution context
   */
  protected override async throwThrottlingException(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const hasApiKey = this.extractApiKey(request) !== null;

    const message = hasApiKey
      ? 'Rate limit exceeded for this API key. Please try again later.'
      : 'Rate limit exceeded. Please try again later.';

    throw new ThrottlerException(message);
  }
}
