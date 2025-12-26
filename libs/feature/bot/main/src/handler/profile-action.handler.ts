/**
 * Profile Action Handler
 *
 * Handles user profile-related actions including viewing profiles.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedBotContext } from '@app/feature-bot-shared';
import { UserEntity, UserStatus } from '@app/database';
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
    const profileText = this.formatProfileView(ctx, ctx.user);
    const keyboard = this.menuHandler.createProfileMenuKeyboard(ctx);

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
