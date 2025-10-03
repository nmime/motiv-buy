import { Injectable, Logger } from '@nestjs/common';
import { AuthUserService } from '@app/feature-auth-shared';
import { UserEntity, PlatformType } from '@app/database';
import { TelegramAuthParams } from '@app/feature-auth-shared';
import { BotContext } from '@app/feature-bot-shared';

/**
 * Bot User Service
 *
 * Handles user authentication and management for bot interactions.
 * This service integrates with the existing auth system to provide
 * bot-specific user management functionality.
 */
@Injectable()
export class BotUserService {
  private readonly logger = new Logger(BotUserService.name);

  constructor(private readonly authUserService: AuthUserService) {}

  /**
   * Find or create user from Telegram bot context
   */
  async findOrCreateUser(ctx: BotContext): Promise<{ user: UserEntity; isNewUser: boolean }> {
    try {
      const telegramUser = ctx.from;
      if (!telegramUser) {
        throw new Error('No user information available in context');
      }

      // Create TelegramAuthParams from bot context
      const telegramAuthParams = new TelegramAuthParams({
        telegramId: telegramUser.id.toString(),
        username: telegramUser.username,
        firstName: telegramUser.first_name || 'Unknown',
        lastName: telegramUser.last_name,
        languageCode: telegramUser.language_code,
        platformType: PlatformType.TelegramBot,
        platformData: {
          telegramVersion: 'bot',
          telegramPlatform: 'telegram-bot',
        },
        // Extract source parameters from start command if available
        sourceParams: this.extractSourceParams(ctx),
        // Note: IP not available in bot context
        ip: undefined,
      });

      // Use the existing auth service for bot users
      const user = await this.authUserService.findOrCreateByBot(telegramAuthParams, {
        trackUserVisit: false,
        trackAnalytics: false,
        trackUserLastAuth: false,
        updateUserFields: true,
      });

      // Check if user was just created by comparing creation time
      const isNewUser = this.isRecentlyCreated(user.createdAt);

      this.logger.debug(`User ${isNewUser ? 'created' : 'found'}`, {
        telegramId: user.telegramId,
        userId: user.id,
        isNewUser,
      });

      return { user, isNewUser };
    } catch (error) {
      this.logger.error('Failed to find or create user', error, {
        telegramId: ctx.from?.id,
        username: ctx.from?.username,
      });

      throw error;
    }
  }

  /**
   * Extract source parameters from bot context
   */
  private extractSourceParams(ctx: BotContext): TelegramAuthParams['sourceParams'] | undefined {
    try {
      // Check if this is a /start command with parameters
      if (ctx.message && 'text' in ctx.message) {
        const { text } = ctx.message;
        if (text?.startsWith('/start ')) {
          const startParam = text.substring(7); // Remove '/start '

          // Handle referral codes
          if (startParam.startsWith('ref_')) {
            return {
              refCode: startParam,
            };
          }

          // Handle other parameters (utm, link codes, etc.)
          // This can be extended based on your specific needs
          const params = this.parseStartParams(startParam);
          if (params) {
            return params;
          }
        }
      }

      return undefined;
    } catch (error) {
      this.logger.warn('Failed to extract source parameters', error);

      return undefined;
    }
  }

  /**
   * Parse start command parameters
   */
  private parseStartParams(param: string): TelegramAuthParams['sourceParams'] | undefined {
    try {
      // Try to parse as JSON (for complex parameters)
      if (param.startsWith('{') && param.endsWith('}')) {
        const parsed = JSON.parse(decodeURIComponent(param));

        return {
          utmSource: parsed.utm_source,
          utmMedium: parsed.utm_medium,
          utmCampaign: parsed.utm_campaign,
          utmContent: parsed.utm_content,
          refCode: parsed.ref_code,
          linkType: parsed.link_type,
          linkCode: parsed.link_code,
        };
      }

      // Handle simple parameters
      if (param.includes('=')) {
        const pairs = param.split('&');
        const params: any = {};

        for (const pair of pairs) {
          const [key, value] = pair.split('=');
          if (key && value) {
            switch (key) {
              case 'utm_source':
                params.utmSource = decodeURIComponent(value);
                break;
              case 'utm_medium':
                params.utmMedium = decodeURIComponent(value);
                break;
              case 'utm_campaign':
                params.utmCampaign = decodeURIComponent(value);
                break;
              case 'utm_content':
                params.utmContent = decodeURIComponent(value);
                break;
              case 'ref':
              case 'ref_code':
                params.refCode = decodeURIComponent(value);
                break;
              case 'link_type':
                params.linkType = decodeURIComponent(value);
                break;
              case 'link_code':
                params.linkCode = decodeURIComponent(value);
                break;
            }
          }
        }

        return Object.keys(params).length > 0 ? params : undefined;
      }

      return undefined;
    } catch (error) {
      this.logger.warn('Failed to parse start parameters', error, { param });

      return undefined;
    }
  }

  /**
   * Check if user was created recently (within last minute)
   */
  private isRecentlyCreated(createdAt: Date): boolean {
    const now = new Date();
    const timeDiff = now.getTime() - createdAt.getTime();

    return timeDiff < 60000; // Less than 1 minute ago
  }

  /**
   * Update user activity timestamp
   */
  async updateUserActivity(user: UserEntity): Promise<void> {
    try {
      // This would typically update the user's last activity
      // For now, we'll just log it since we don't want to hit the DB on every interaction
      this.logger.debug(`User activity updated`, {
        userId: user.id,
        telegramId: user.telegramId,
      });
    } catch (error) {
      this.logger.warn('Failed to update user activity', error, { userId: user.id });
    }
  }
}
