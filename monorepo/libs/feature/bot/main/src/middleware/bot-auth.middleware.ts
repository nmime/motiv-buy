import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import { BotUserService, BotSessionService } from '../service/auth';

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
   * Middleware function for Grammy bot
   */
  async middleware(ctx: BotContext, next: () => Promise<void>): Promise<void> {
    try {
      await this.authenticateUser(ctx);
      await next();
    } catch (error) {
      this.logger.error('Authentication middleware error', error, {
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
          (ctx as any).user = sessionUser; // Cast to bypass type checking for now
          (ctx as any).sessionId = existingSessionId;
          (ctx as any).isNewUser = false;

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

      // Populate context
      (ctx as any).user = user;
      (ctx as any).sessionId = sessionId;
      (ctx as any).isNewUser = isNewUser;

      this.logger.debug('User authenticated and session created', {
        telegramId,
        userId: user.id,
        sessionId,
        isNewUser,
      });
    } catch (error) {
      this.logger.error('Failed to authenticate user', error, {
        telegramId,
      });

      // Clear any corrupted session data
      try {
        await this.botSessionService.clearUserSessions(telegramId);
      } catch (clearError) {
        this.logger.error('Failed to clear corrupted sessions', clearError, { telegramId });
      }
    }
  }

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
}
