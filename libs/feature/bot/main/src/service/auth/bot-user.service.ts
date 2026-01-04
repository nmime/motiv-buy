import { Injectable, Logger } from '@nestjs/common';
import { AuthUserService, LinkType, TelegramAuthParams } from '@app/feature-auth-shared';
import { PlatformType, UserEntity } from '@app/database';
import { BotContext } from '@app/feature-bot-shared';
import { I18nService } from 'nestjs-i18n';

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

  constructor(
    private readonly authUserService: AuthUserService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Find or create user from Telegram bot context
   */
  async findOrCreateUser(ctx: BotContext): Promise<{ user: UserEntity; isNewUser: boolean }> {
    try {
      const telegramUser = ctx.from;
      if (!telegramUser) {
        throw new Error(this.i18n.t('common.errors.no_user_info'));
      }

      // Detect if this is a /start command
      const isStartCommand = this.isStartCommand(ctx);

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
      // Visit tracking: ONLY on /start command
      // Analytics and last auth: ALWAYS enabled
      const user = await this.authUserService.findOrCreateByBot(telegramAuthParams, {
        trackUserVisit: isStartCommand,
        trackAnalytics: true,
        trackUserLastAuth: true,
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
    } catch (err: unknown) {
      this.logger.error('Failed to find or create user', err, {
        telegramId: ctx.from?.id,
        username: ctx.from?.username,
      });

      throw err;
    }
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
    } catch (err: unknown) {
      this.logger.warn('Failed to update user activity', err, { userId: user.id });
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
    } catch (err: unknown) {
      this.logger.warn('Failed to extract source parameters', err);

      return undefined;
    }
  }

  /**
   * Parse start command parameters
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity
  private parseStartParams(param: string): TelegramAuthParams['sourceParams'] | undefined {
    try {
      // Try to parse as JSON (for complex parameters)
      if (param.startsWith('{') && param.endsWith('}')) {
        interface ParsedParam {
          utm_source?: string;
          utm_medium?: string;
          utm_campaign?: string;
          utm_content?: string;
          ref_code?: string;
          link_type?: string;
          link_code?: string;
        }
        const parsed = JSON.parse(decodeURIComponent(param)) as ParsedParam;

        return {
          utmSource: parsed.utm_source,
          utmMedium: parsed.utm_medium,
          utmCampaign: parsed.utm_campaign,
          utmContent: parsed.utm_content,
          refCode: parsed.ref_code,
          linkType: parsed.link_type as LinkType | undefined,
          linkCode: parsed.link_code,
        };
      }

      // Handle simple parameters
      if (param.includes('=')) {
        const pairs = param.split('&');

        interface UTMParams {
          utmSource?: string;
          utmMedium?: string;
          utmCampaign?: string;
          utmContent?: string;
          utmTerm?: string;
          referralCode?: string;
          refCode?: string;
          linkType?: LinkType;
          linkCode?: string;
        }

        const params: UTMParams = {};

        const keySetters: Record<string, (value: string) => void> = {
          /* eslint-disable @typescript-eslint/naming-convention */
          utm_source: (v) => {
            params.utmSource = decodeURIComponent(v);
          },
          utm_medium: (v) => {
            params.utmMedium = decodeURIComponent(v);
          },
          utm_campaign: (v) => {
            params.utmCampaign = decodeURIComponent(v);
          },
          utm_content: (v) => {
            params.utmContent = decodeURIComponent(v);
          },
          ref: (v) => {
            params.refCode = decodeURIComponent(v);
          },
          ref_code: (v) => {
            params.refCode = decodeURIComponent(v);
          },
          link_type: (v) => {
            params.linkType = decodeURIComponent(v) as LinkType;
          },
          link_code: (v) => {
            params.linkCode = decodeURIComponent(v);
          },
          /* eslint-enable @typescript-eslint/naming-convention */
        };

        for (const pair of pairs) {
          const [key, value] = pair.split('=');
          if (key && value) {
            const setter = keySetters[key];

            if (setter) {
              setter(value);
            }
          }
        }

        return Object.keys(params).length > 0 ? params : undefined;
      }

      return undefined;
    } catch (err: unknown) {
      this.logger.warn('Failed to parse start parameters', err, { param });

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
   * Check if the current context is a /start command
   */
  private isStartCommand(ctx: BotContext): boolean {
    if (ctx.message && 'text' in ctx.message) {
      const { text } = ctx.message;

      return text?.startsWith('/start') ?? false;
    }

    return false;
  }
}
