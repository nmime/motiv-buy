import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { BotContext } from '@app/feature-bot-shared';
import { UserEntity } from '@app/database';
import { updateContextTranslation } from '@app/common-intl';
import { BotSessionService, BotUserService } from '../service/auth';

/**
 * Bot Authentication Middleware
 *
 * Handles user authentication for all bot interactions
 * Populates ctx.user with authenticated user data
 */
@Injectable()
export class BotAuthMiddleware {
  private readonly logger = new Logger(BotAuthMiddleware.name);

  constructor(
    private readonly botUserService: BotUserService,
    private readonly botSessionService: BotSessionService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Create middleware function factory
   */
  static create(
    botUserService: BotUserService,
    botSessionService: BotSessionService,
    i18n: I18nService,
  ): (ctx: BotContext, next: () => Promise<void>) => Promise<void> {
    const middleware = new BotAuthMiddleware(botUserService, botSessionService, i18n);

    return middleware.middleware.bind(middleware);
  }

  /**
   * Create requireAuth middleware that blocks unauthenticated users
   * Use this before handlers that require authentication
   */
  static createRequireAuth(): (ctx: BotContext, next: () => Promise<void>) => Promise<void> {
    return async (ctx: BotContext, next: () => Promise<void>) => {
      if (!ctx.user || !ctx.isAuthenticated) {
        await ctx.reply(ctx.t('common.errors.auth_required'));

        return;
      }

      await next();
    };
  }

  /**
   * Middleware function for Grammy bot
   */
  async middleware(ctx: BotContext, next: () => Promise<void>): Promise<void> {
    try {
      await this.authenticateUser(ctx);
    } catch (err: unknown) {
      this.logger.error('Authentication middleware error', err, {
        telegramId: ctx.from?.id,
        chatId: ctx.chat?.id,
      });
      // Continue even if auth fails - don't break the bot
    }

    // Always call next() exactly once
    await next();
  }

  /**
   * Sync language from user to session and i18n context
   * Also updates ctx.t() to use the user's language
   */
  private syncUserLanguage(ctx: BotContext, user: Partial<UserEntity>): void {
    if (!user.language) {
      return;
    }

    if (ctx.session) {
      ctx.session.language = user.language;
    }

    // Update ctx.language AND recreate ctx.t() to use the new language
    // This ensures translations work correctly after auth middleware runs
    updateContextTranslation(ctx, this.i18n, user.language);
  }

  /**
   * Authenticate user and populate context
   */
  private async authenticateUser(ctx: BotContext): Promise<void> {
    if (!ctx.from) {
      this.logger.warn('No user information in context');

      return;
    }

    const telegramId = ctx.from.id.toString();

    try {
      // Try to get existing session first
      const existingSessionId = await this.botSessionService.getSessionIdByTelegramId(telegramId);

      if (existingSessionId) {
        const sessionUser = await this.botSessionService.getUserSession(existingSessionId);

        if (sessionUser && sessionUser.id) {
          // User found in session, use cached data
          // Safe dynamic property assignment to extend context
          Object.assign(ctx, {
            user: sessionUser,
            sessionId: existingSessionId,
            isNewUser: false,
            isAuthenticated: true,
          });

          // Sync language from database to session and i18n context
          this.syncUserLanguage(ctx, sessionUser);

          // Update session activity
          await this.botSessionService.updateSessionActivity(existingSessionId);

          this.logger.debug('User authenticated from session', {
            telegramId,
            userId: sessionUser.id,
            sessionId: existingSessionId,
          });

          return;
        }
      }

      // No valid session, find or create user
      const { user, isNewUser } = await this.botUserService.findOrCreateUser(ctx);

      // Generate new session
      const sessionId = this.botSessionService.generateSessionId(telegramId);

      // Store session
      await this.botSessionService.storeUserSession(sessionId, user);

      // Update user activity
      await this.botUserService.updateUserActivity(user);

      // Populate context - safe dynamic property assignment
      Object.assign(ctx, {
        user,
        sessionId,
        isNewUser,
        isAuthenticated: true,
      });

      // Sync language from database to session and i18n context
      this.syncUserLanguage(ctx, user);

      this.logger.debug('User authenticated and session created', {
        telegramId,
        userId: user.id,
        sessionId,
        isNewUser,
      });
    } catch (err: unknown) {
      this.logger.error('Failed to authenticate user', err, {
        telegramId,
      });

      // Clear any corrupted session data
      try {
        await this.botSessionService.clearUserSessions(telegramId);
      } catch (clearErr: unknown) {
        this.logger.error('Failed to clear corrupted sessions', clearErr, { telegramId });
      }
    }
  }
}
