import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { FastifyRequest } from 'fastify';

/**
 * API Key Throttler Guard
 *
 * Provides per-API-key rate limiting for public API endpoints.
 * Extends ThrottlerGuard to use API key from request body as the tracking identifier.
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
   * 1. API key from request body (if present)
   * 2. Cloudflare connecting IP
   * 3. X-Real-IP header
   * 4. Request IP
   *
   * @param req - Fastify request object
   * @returns Unique identifier for rate limiting
   */
  protected override async getTracker(req: FastifyRequest): Promise<string> {
    // Extract API key from request body (for POST endpoints)
    const body = req.body as Record<string, unknown> | undefined;
    const apiKey = body?.apiKey as string | undefined;

    if (apiKey && typeof apiKey === 'string' && apiKey.length > 0) {
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
   * Throw custom throttling exception
   *
   * Provides a clear error message for rate-limited requests
   *
   * @param context - Execution context
   */
  protected override throwThrottlingException(context: ExecutionContext): void {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const body = request.body as Record<string, unknown> | undefined;
    const hasApiKey = body?.apiKey && typeof body.apiKey === 'string';

    const message = hasApiKey
      ? 'Rate limit exceeded for this API key. Please try again later.'
      : 'Rate limit exceeded. Please try again later.';

    throw new ThrottlerException(message);
  }
}
