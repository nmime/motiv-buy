/**
 * Profile Handler
 *
 * Grammy Composer for profile-related callback queries.
 * Handles profile viewing.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Composer } from 'grammy';
import { AuthenticatedBotContext, BotContext, isAuthenticated } from '@app/feature-bot-shared';
import { UserEntity, UserStatus } from '@app/database';
import { MessageService } from '../../service/message.service';
import { createProfileMenuKeyboard } from './profile.keyboards';

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
    this.composer.callbackQuery('profile:view', (ctx) =>
      this.withAuth(ctx, (authCtx) => this.handleProfileView(authCtx)),
    );

    this.composer.callbackQuery('menu:profile', (ctx) =>
      this.withAuth(ctx, (authCtx) => this.handleProfileView(authCtx)),
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
      `<b>${ctx.t('profile.member_since')}:</b> ${this.messageService.formatDate(ctx, user.createdAt)}`
    );
  }
}
