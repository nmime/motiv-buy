/**
 * Profile Action Handler
 *
 * Handles user profile-related actions including viewing
 * and verification of user profiles.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedBotContext } from '@app/feature-bot-shared';
import { UserEntity, UserRole, UserStatus } from '@app/database';
import { MenuActionHandler } from './menu-action.handler';
import { MessageService } from '../service/message.service';

@Injectable()
export class ProfileActionHandler {
  private readonly logger = new Logger(ProfileActionHandler.name);

  constructor(
    private readonly menuHandler: MenuActionHandler,
    private readonly messageService: MessageService,
  ) {}

  /**
   * Handle profile view action
   *
   * Note: This handler must be wrapped with protectHandler()
   * Context type guarantees user exists - no null checks or assertions needed
   */
  async handleProfileView(ctx: AuthenticatedBotContext): Promise<void> {
    // ctx.user is GUARANTEED by AuthenticatedBotContext type - no ! needed
    const profileText = this.formatProfileView(ctx, ctx.user);
    const keyboard = this.menuHandler.createProfileMenuKeyboard(ctx);

    await this.messageService.sendOrEditMessage(ctx, {
      text: profileText,

      replyMarkup: keyboard,
    });

    this.logger.log('Profile viewed', { userId: ctx.user.id, telegramId: ctx.user.telegramId });
  }

  /**
   * Handle profile details view
   *
   * Note: This handler must be wrapped with protectHandler()
   */
  async handleProfileDetails(ctx: AuthenticatedBotContext): Promise<void> {
    const detailsText = this.formatProfileDetails(ctx, ctx.user);
    const keyboard = this.menuHandler.createBackButton('profile:view', ctx.t('common.back'));

    await this.messageService.sendOrEditMessage(ctx, {
      text: detailsText,

      replyMarkup: keyboard,
    });
  }

  /**
   * Format date safely (handles undefined from session cache)
   */
  private formatDate(
    ctx: AuthenticatedBotContext,
    date: Date | undefined,
    format: 'date' | 'datetime' = 'datetime',
  ): string {
    if (!date) {
      return ctx.t('profile.na');
    }

    return format === 'date' ? date.toLocaleDateString() : date.toLocaleString();
  }

  /**
   * Format profile view text
   */
  private formatProfileView(ctx: AuthenticatedBotContext, user: Partial<UserEntity>): string {
    const statusEmojiMap: Record<UserStatus, string> = {
      [UserStatus.Active]: '✅',
      [UserStatus.Restricted]: '⚠️',
      [UserStatus.Banned]: '🚫',
    };

    const statusEmoji = user.status ? statusEmojiMap[user.status] || '❓' : '❓';

    return (
      `<b>${ctx.t('profile.title')}</b>\n\n` +
      `<b>${ctx.t('profile.name')}:</b> ${user.firstName || ctx.t('profile.unknown')}${user.lastName ? ' ' + user.lastName : ''}\n` +
      `<b>${ctx.t('profile.username')}:</b> ${user.username || ctx.t('profile.not_set')}\n` +
      `<b>${ctx.t('profile.status')}:</b> ${statusEmoji} ${user.status || ctx.t('profile.unknown')}\n` +
      `<b>${ctx.t('profile.referrals')}:</b> ${user.referralCount ?? 0}\n` +
      `<b>${ctx.t('profile.member_since')}:</b> ${this.formatDate(ctx, user.createdAt, 'date')}\n\n` +
      `<i>${ctx.t('profile.manage_hint')}</i>`
    );
  }

  /**
   * Format profile details text
   */
  private formatProfileDetails(ctx: AuthenticatedBotContext, user: Partial<UserEntity>): string {
    const isActive = user.status === UserStatus.Active;
    const isAdmin = user.role !== undefined && user.role !== UserRole.User;

    return (
      `<b>${ctx.t('profile.details_title')}</b>\n\n` +
      `<b>${ctx.t('profile.user_id')}:</b> <code>${user.id || ctx.t('profile.na')}</code>\n` +
      `<b>${ctx.t('profile.telegram_id')}:</b> <code>${user.telegramId || ctx.t('profile.na')}</code>\n` +
      `<b>${ctx.t('profile.name')}:</b> ${user.firstName || ctx.t('profile.unknown')}${user.lastName ? ' ' + user.lastName : ''}\n` +
      `<b>${ctx.t('profile.username')}:</b> ${user.username || ctx.t('profile.not_set')}\n` +
      `<b>${ctx.t('profile.language')}:</b> ${user.languageCode || ctx.t('profile.not_set')}\n\n` +
      `<b>${ctx.t('profile.account_status')}:</b>\n` +
      `• ${ctx.t('profile.status')}: ${user.status || ctx.t('profile.unknown')}\n` +
      `• ${ctx.t('profile.role')}: ${user.role || ctx.t('profile.unknown')}\n` +
      `• ${ctx.t('profile.active')}: ${isActive ? ctx.t('profile.yes') : ctx.t('profile.no')}\n` +
      `• ${ctx.t('profile.admin')}: ${isAdmin ? ctx.t('profile.yes') : ctx.t('profile.no')}\n\n` +
      `<b>${ctx.t('profile.referral_info')}:</b>\n` +
      `• ${ctx.t('profile.total_referrals')}: ${user.referralCount ?? 0}\n` +
      `• ${ctx.t('profile.referred_by')}: ${user.referredBy || ctx.t('profile.none')}\n\n` +
      `<b>${ctx.t('profile.timestamps')}:</b>\n` +
      `• ${ctx.t('profile.created')}: ${this.formatDate(ctx, user.createdAt)}\n` +
      `• ${ctx.t('profile.last_active')}: ${this.formatDate(ctx, user.lastActiveAt)}`
    );
  }
}
