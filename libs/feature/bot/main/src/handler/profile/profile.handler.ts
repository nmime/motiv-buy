/**
 * Profile Handler
 *
 * Grammy Composer for profile-related callback queries.
 * Handles profile viewing and user details.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Composer } from 'grammy';
import { AuthenticatedBotContext, BotContext, isAuthenticated } from '@app/feature-bot-shared';
import { UserEntity, UserRole, UserStatus } from '@app/database';
import { MessageService } from '../../service/message.service';
import { createProfileMenuKeyboard, createBackToProfileKeyboard } from './profile.keyboards';

@Injectable()
export class ProfileHandler {
  private readonly logger = new Logger(ProfileHandler.name);
  private composer: Composer<BotContext>;

  constructor(private readonly messageService: MessageService) {
    this.composer = new Composer<BotContext>();
    this.setupHandlers();
  }

  /**
   * Get Grammy composer for use in bot service
   */
  getComposer(): Composer<BotContext> {
    return this.composer;
  }

  /**
   * Setup all callback query handlers
   */
  private setupHandlers(): void {
    // Profile view
    this.composer.callbackQuery('profile:view', (ctx) =>
      this.withAuth(ctx, (authCtx) => this.handleProfileView(authCtx)),
    );

    this.composer.callbackQuery('menu:profile', (ctx) =>
      this.withAuth(ctx, (authCtx) => this.handleProfileView(authCtx)),
    );

    // Profile details
    this.composer.callbackQuery('profile:details', (ctx) =>
      this.withAuth(ctx, (authCtx) => this.handleProfileDetails(authCtx)),
    );
  }

  /**
   * Auth wrapper for handlers - passes authenticated context to handler
   */
  private async withAuth(ctx: BotContext, handler: (authCtx: AuthenticatedBotContext) => Promise<void>): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.authentication_required'),
      });

      return;
    }

    await handler(ctx);
  }

  /**
   * Handle profile view action
   */
  async handleProfileView(ctx: AuthenticatedBotContext): Promise<void> {
    const profileText = this.formatProfileView(ctx, ctx.user);
    const keyboard = createProfileMenuKeyboard(ctx);

    await this.messageService.sendOrEditMessage(ctx, {
      text: profileText,
      replyMarkup: keyboard,
    });

    this.logger.log('Profile viewed', { userId: ctx.user.id, telegramId: ctx.user.telegramId });
  }

  /**
   * Handle profile details view
   */
  async handleProfileDetails(ctx: AuthenticatedBotContext): Promise<void> {
    const detailsText = this.formatProfileDetails(ctx, ctx.user);
    const keyboard = createBackToProfileKeyboard(ctx);

    await this.messageService.sendOrEditMessage(ctx, {
      text: detailsText,
      replyMarkup: keyboard,
    });
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

    const statusEmoji = user.status ? statusEmojiMap[user.status] : '❓';

    return (
      `<b>${ctx.t('profile.title')}</b>\n\n` +
      `<b>${ctx.t('profile.name')}:</b> ${user.firstName ?? ctx.t('profile.unknown')}${user.lastName ? ' ' + user.lastName : ''}\n` +
      `<b>${ctx.t('profile.username')}:</b> ${user.username ?? ctx.t('profile.not_set')}\n` +
      `<b>${ctx.t('profile.status')}:</b> ${statusEmoji} ${user.status ?? ctx.t('profile.unknown')}\n` +
      `<b>${ctx.t('profile.referrals')}:</b> ${user.referralCount ?? 0}\n` +
      `<b>${ctx.t('profile.member_since')}:</b> ${this.messageService.formatDate(ctx, user.createdAt)}\n\n` +
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
      `<b>${ctx.t('profile.user_id')}:</b> <code>${user.id ?? ctx.t('profile.na')}</code>\n` +
      `<b>${ctx.t('profile.telegram_id')}:</b> <code>${user.telegramId ?? ctx.t('profile.na')}</code>\n` +
      `<b>${ctx.t('profile.name')}:</b> ${user.firstName ?? ctx.t('profile.unknown')}${user.lastName ? ' ' + user.lastName : ''}\n` +
      `<b>${ctx.t('profile.username')}:</b> ${user.username ?? ctx.t('profile.not_set')}\n` +
      `<b>${ctx.t('profile.language')}:</b> ${user.languageCode ?? ctx.t('profile.not_set')}\n\n` +
      `<b>${ctx.t('profile.account_status')}:</b>\n` +
      `• ${ctx.t('profile.status')}: ${user.status ?? ctx.t('profile.unknown')}\n` +
      `• ${ctx.t('profile.role')}: ${user.role ?? ctx.t('profile.unknown')}\n` +
      `• ${ctx.t('profile.active')}: ${isActive ? ctx.t('profile.yes') : ctx.t('profile.no')}\n` +
      `• ${ctx.t('profile.admin')}: ${isAdmin ? ctx.t('profile.yes') : ctx.t('profile.no')}\n\n` +
      `<b>${ctx.t('profile.referral_info')}:</b>\n` +
      `• ${ctx.t('profile.total_referrals')}: ${user.referralCount ?? 0}\n` +
      `• ${ctx.t('profile.referred_by')}: ${user.referredBy ?? ctx.t('profile.none')}\n\n` +
      `<b>${ctx.t('profile.timestamps')}:</b>\n` +
      `• ${ctx.t('profile.created')}: ${this.messageService.formatDateTime(ctx, user.createdAt)}\n` +
      `• ${ctx.t('profile.last_active')}: ${this.messageService.formatDateTime(ctx, user.lastActiveAt)}`
    );
  }
}
