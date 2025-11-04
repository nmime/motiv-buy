/**
 * CSRF Protection Middleware
 *
 * Implements CSRF protection for multi-step actions by generating
 * and validating tokens stored in user sessions.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import { randomBytes } from 'crypto';

interface CsrfToken {
  token: string;
  action: string;
  createdAt: number;
  expiresAt: number;
}

@Injectable()
export class CsrfProtectionMiddleware {
  private readonly logger = new Logger(CsrfProtectionMiddleware.name);
  private readonly TOKEN_LIFETIME = 30 * 60 * 1000; // 30 minutes

  /**
   * Generate CSRF token for action
   */
  generateToken(ctx: BotContext, action: string): string {
    if (!ctx.session) {
      throw new Error('Session not available for CSRF token generation');
    }

    const token = this.createToken();
    const now = Date.now();

    const csrfToken: CsrfToken = {
      token,
      action,
      createdAt: now,
      expiresAt: now + this.TOKEN_LIFETIME,
    };

    // Store token in session
    if (!ctx.session.temp) {
      ctx.session.temp = {};
    }

    ctx.session.temp.csrfToken = csrfToken;

    this.logger.debug('CSRF token generated', {
      userId: ctx.from?.id,
      action,
      token: token.substring(0, 8) + '...',
    });

    return token;
  }

  /**
   * Validate CSRF token
   */
  async validateToken(ctx: BotContext, token: string, action: string): Promise<boolean> {
    if (!ctx.session || !ctx.session.temp?.csrfToken) {
      this.logger.warn('CSRF validation failed: No token in session', {
        userId: ctx.from?.id,
        action,
      });

      await ctx.reply('❌ Security validation failed. Please try again.');

      return false;
    }

    const storedToken = ctx.session.temp.csrfToken as CsrfToken;

    // Check if token expired
    if (Date.now() > storedToken.expiresAt) {
      this.logger.warn('CSRF validation failed: Token expired', {
        userId: ctx.from?.id,
        action,
      });

      await ctx.reply('❌ Your session has expired. Please start again.');
      this.clearToken(ctx);

      return false;
    }

    // Check if token matches
    if (storedToken.token !== token) {
      this.logger.warn('CSRF validation failed: Token mismatch', {
        userId: ctx.from?.id,
        action,
      });

      await ctx.reply('❌ Security validation failed. Please try again.');

      return false;
    }

    // Check if action matches
    if (storedToken.action !== action) {
      this.logger.warn('CSRF validation failed: Action mismatch', {
        userId: ctx.from?.id,
        action,
        expectedAction: storedToken.action,
      });

      await ctx.reply('❌ Invalid action. Please start again.');

      return false;
    }

    this.logger.debug('CSRF token validated successfully', {
      userId: ctx.from?.id,
      action,
    });

    return true;
  }

  /**
   * Validate and consume token (one-time use)
   */
  async validateAndConsumeToken(ctx: BotContext, token: string, action: string): Promise<boolean> {
    const isValid = await this.validateToken(ctx, token, action);

    if (isValid) {
      this.clearToken(ctx);
    }

    return isValid;
  }

  /**
   * Clear CSRF token from session
   */
  clearToken(ctx: BotContext): void {
    if (ctx.session?.temp?.csrfToken) {
      delete ctx.session.temp.csrfToken;
    }
  }

  /**
   * Check if action requires CSRF protection
   */
  requiresCsrfProtection(action: string): boolean {
    const protectedActions = [
      'withdrawal',
      'order_create',
      'order_cancel',
      'settings_update',
      'profile_edit',
      'payment_confirm',
    ];

    return protectedActions.some((pa) => action.startsWith(pa));
  }

  /**
   * Middleware function to check CSRF for callback queries
   */
  async checkCsrfForCallback(ctx: BotContext, next: () => Promise<void>): Promise<void> {
    if (!ctx.callbackQuery?.data) {
      return next();
    }

    const { data } = ctx.callbackQuery;
    const [action] = data.split(':');

    // Only check CSRF for protected actions
    if (!this.requiresCsrfProtection(action)) {
      return next();
    }

    // Extract token from callback data if present
    const tokenMatch = data.match(/token=([a-f0-9]+)/);

    if (!tokenMatch) {
      this.logger.warn('CSRF check failed: No token in callback data', {
        userId: ctx.from?.id,
        action,
      });

      await ctx.answerCallbackQuery('Security validation failed');
      await ctx.reply('❌ Security validation failed. Please try again.');

      return;
    }

    const token = tokenMatch[1];
    const isValid = await this.validateToken(ctx, token, action);

    if (!isValid) {
      await ctx.answerCallbackQuery('Security validation failed');

      return;
    }

    return next();
  }

  /**
   * Generate protected callback data with CSRF token
   */
  generateProtectedCallbackData(ctx: BotContext, action: string, params: Record<string, string> = {}): string {
    const token = this.generateToken(ctx, action);

    const paramsWithToken = {
      ...params,
      token,
    };

    const paramString = Object.entries(paramsWithToken)
      .map(([key, value]) => `${key}=${value}`)
      .join(':');

    return `${action}:${paramString}`;
  }

  /**
   * Create random token
   */
  private createToken(): string {
    return randomBytes(32).toString('hex');
  }
}
