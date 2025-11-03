/**
 * Rate Limit Middleware
 *
 * Implements rate limiting per user to prevent abuse and ensure
 * fair usage of bot resources. Uses in-memory storage with TTL.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
}

@Injectable()
export class RateLimitMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly rateLimits = new Map<string, RateLimitEntry>();
  private readonly blockedUsers = new Map<string, number>();

  // Default rate limit: 20 requests per minute
  private readonly defaultConfig: RateLimitConfig = {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 5 * 60 * 1000, // 5 minutes
  };

  // Different rate limits for different action types
  private readonly rateLimitConfigs: Record<string, RateLimitConfig> = {
    message: {
      maxRequests: 20,
      windowMs: 60 * 1000,
    },
    callback: {
      maxRequests: 30,
      windowMs: 60 * 1000,
    },
    withdrawal: {
      maxRequests: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      blockDurationMs: 30 * 60 * 1000, // 30 minutes
    },
    order_create: {
      maxRequests: 10,
      windowMs: 60 * 60 * 1000, // 1 hour
    },
  };

  /**
   * Check if user is rate limited
   */
  async checkRateLimit(ctx: BotContext, actionType = 'message'): Promise<boolean> {
    if (!ctx.from) {
      return true; // Allow if no user info (shouldn't happen in normal flow)
    }

    const userId = ctx.from.id.toString();
    const key = `${userId}:${actionType}`;

    // Check if user is blocked
    if (this.isUserBlocked(userId)) {
      const blockedUntil = this.blockedUsers.get(userId);
      if (blockedUntil) {
        const remainingMinutes = Math.ceil((blockedUntil - Date.now()) / 1000 / 60);
        await ctx.reply(
          `⚠️ You have been temporarily blocked due to excessive requests.\n` +
            `Please try again in ${remainingMinutes} minute(s).`,
        );
      }

      return false;
    }

    const config = this.rateLimitConfigs[actionType] || this.defaultConfig;
    const now = Date.now();
    const entry = this.rateLimits.get(key);

    if (!entry || now > entry.resetAt) {
      // Create new entry or reset expired one
      this.rateLimits.set(key, {
        count: 1,
        resetAt: now + config.windowMs,
      });

      return true;
    }

    if (entry.count >= config.maxRequests) {
      // Rate limit exceeded
      const remainingSeconds = Math.ceil((entry.resetAt - now) / 1000);

      // Block user if they exceed limits repeatedly
      if (entry.count >= config.maxRequests * 1.5) {
        this.blockUser(userId, config.blockDurationMs);
        this.logger.warn('User blocked due to excessive requests', {
          userId,
          actionType,
          count: entry.count,
        });

        await ctx.reply(
          `🚫 You have been temporarily blocked due to excessive requests.\n` +
            `Please try again in ${Math.ceil((config.blockDurationMs || 0) / 1000 / 60)} minutes.`,
        );
      } else {
        await ctx.reply(`⚠️ Rate limit exceeded. Please wait ${remainingSeconds} second(s) before trying again.`);
      }

      this.logger.warn('Rate limit exceeded', {
        userId,
        actionType,
        count: entry.count,
        maxRequests: config.maxRequests,
      });

      return false;
    }

    // Increment counter
    entry.count++;

    return true;
  }

  /**
   * Check if user is blocked
   */
  private isUserBlocked(userId: string): boolean {
    const blockedUntil = this.blockedUsers.get(userId);

    if (!blockedUntil) {
      return false;
    }

    if (Date.now() > blockedUntil) {
      // Block expired, remove it
      this.blockedUsers.delete(userId);

      return false;
    }

    return true;
  }

  /**
   * Block user temporarily
   */
  private blockUser(userId: string, durationMs: number = 5 * 60 * 1000): void {
    const blockedUntil = Date.now() + durationMs;
    this.blockedUsers.set(userId, blockedUntil);

    // Clear rate limit entries for this user
    const keysToDelete: string[] = [];
    for (const key of this.rateLimits.keys()) {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.rateLimits.delete(key));
  }

  /**
   * Clean up expired entries (call periodically)
   */
  cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleaned = 0;

    // Clean rate limit entries
    for (const [key, entry] of this.rateLimits.entries()) {
      if (now > entry.resetAt) {
        this.rateLimits.delete(key);
        cleaned++;
      }
    }

    // Clean blocked users
    for (const [userId, blockedUntil] of this.blockedUsers.entries()) {
      if (now > blockedUntil) {
        this.blockedUsers.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  /**
   * Get rate limit status for user
   */
  getRateLimitStatus(
    userId: string,
    actionType = 'message',
  ): {
    remaining: number;
    resetAt: number;
    isBlocked: boolean;
  } {
    const key = `${userId}:${actionType}`;
    const config = this.rateLimitConfigs[actionType] || this.defaultConfig;
    const entry = this.rateLimits.get(key);

    if (!entry || Date.now() > entry.resetAt) {
      return {
        remaining: config.maxRequests,
        resetAt: Date.now() + config.windowMs,
        isBlocked: false,
      };
    }

    return {
      remaining: Math.max(0, config.maxRequests - entry.count),
      resetAt: entry.resetAt,
      isBlocked: this.isUserBlocked(userId),
    };
  }

  /**
   * Reset rate limit for user (admin use)
   */
  resetUserRateLimit(userId: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.rateLimits.keys()) {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.rateLimits.delete(key));
    this.blockedUsers.delete(userId);

    this.logger.log('Rate limit reset for user', { userId });
  }
}
