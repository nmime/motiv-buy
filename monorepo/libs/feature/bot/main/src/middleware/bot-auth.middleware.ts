import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
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
  ) {}

  /**
   * Create middleware function factory
   */
  static create(
    botUserService: BotUserService,
    botSessionService: BotSessionService,
  ): (ctx: BotContext, next: () => Promise<void>) => Promise<void> {
    const middleware = new BotAuthMiddleware(botUserService, botSessionService);

    return middleware.middleware.bind(middleware);
  }

  /**
   * Middleware function for Grammy bot
   */
  async middleware(ctx: BotContext, next: () => Promise<void>): Promise<void> {
    try {
      await this.authenticateUser(ctx);
      await next();
    } catch (err: unknown) {
      this.logger.error('Authentication middleware error', err, {
        telegramId: ctx.from?.id,
        chatId: ctx.chat?.id,
      });

      // Continue with next handler even if auth fails
      // This ensures the bot doesn't break completely
      await next();
    }
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
          });

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
      });

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
