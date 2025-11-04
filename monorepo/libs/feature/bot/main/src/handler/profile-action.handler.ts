/**
 * Profile Action Handler
 *
 * Handles user profile-related actions including viewing, editing,
 * and verification of user profiles.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import { EntityManager } from '@mikro-orm/core';
import { UserEntity, UserStatus } from '@app/database';
import { BotValidationUtil } from '../util/bot-validation.util';
import { MenuActionHandler } from './menu-action.handler';
import { MessageService } from '../service/message.service';

@Injectable()
export class ProfileActionHandler {
  private readonly logger = new Logger(ProfileActionHandler.name);

  constructor(
    private readonly em: EntityManager,
    private readonly menuHandler: MenuActionHandler,
    private readonly messageService: MessageService,
  ) {}

  /**
   * Handle profile view action
   */
  async handleProfileView(ctx: BotContext): Promise<void> {
    const em = this.em.fork();
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const user = await em.findOne(UserEntity, { telegramId: ctx.from.id.toString() });

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      const profileText = this.formatProfileView(user);
      const keyboard = this.menuHandler.createProfileMenuKeyboard();

      await this.messageService.sendOrEditMessage(ctx, {
        text: profileText,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      this.logger.log('Profile viewed', { userId: user.id, telegramId: user.telegramId });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle profile edit initiation
   */
  async handleProfileEditStart(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      // Store edit mode in session
      if (ctx.session) {
        ctx.session.conversationState = 'profile_edit';
        ctx.session.formData = { step: 'select_field' };
      }

      const editKeyboard = this.createProfileEditKeyboard();

      await ctx.reply(ctx.t('user.profile.edit_prompt'), {
        reply_markup: editKeyboard,
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle profile field update
   */
  async handleProfileFieldUpdate(ctx: BotContext, field: string, value: string): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      // Validate input based on field type
      const validation = this.validateProfileField(field, value);

      if (!validation.isValid) {
        await ctx.reply(`❌ ${validation.error}\n\nPlease try again or use /cancel to abort.`);

        return;
      }

      const user = await this.findUserByTelegramId(ctx.from.id.toString());

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      // Update user field
      await this.updateUserField(user, field, validation.sanitized as string);

      await ctx.reply(`✅ Successfully updated ${field}!`);

      // Clear session state
      if (ctx.session) {
        ctx.session.conversationState = undefined;
        ctx.session.formData = {};
      }

      // Show updated profile
      await this.handleProfileView(ctx);

      this.logger.log('Profile updated', {
        userId: user.id,
        field,
        telegramId: user.telegramId,
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle profile details view
   */
  async handleProfileDetails(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const user = await this.findUserByTelegramId(ctx.from.id.toString());

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      const detailsText = this.formatProfileDetails(user);
      const keyboard = this.menuHandler.createBackButton('menu:profile');

      await ctx.replyWithHTML(detailsText, { reply_markup: keyboard });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle account verification
   */
  async handleVerification(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const user = await this.findUserByTelegramId(ctx.from.id.toString());

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      if (user.isVerified) {
        await ctx.reply(ctx.t('user.profile.already_verified'));

        return;
      }

      const verificationText =
        '🔐 <b>Account Verification</b>\n\n' +
        'To verify your account, please complete the following steps:\n\n' +
        '1. Ensure your profile information is complete\n' +
        '2. Complete at least 5 traffic orders successfully\n' +
        '3. Maintain a good reputation score\n\n' +
        'Once all requirements are met, your account will be automatically verified.';

      await ctx.replyWithHTML(verificationText);

      this.logger.log('Verification info viewed', { userId: user.id });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Find user by Telegram ID
   */
  private async findUserByTelegramId(telegramId: string): Promise<UserEntity | null> {
    return await this.em.findOne(UserEntity, { telegramId });
  }

  /**
   * Update user field
   */
  private async updateUserField(user: UserEntity, field: string, value: string): Promise<void> {
    switch (field) {
      case 'username':
        user.username = value;
        break;
      case 'firstName':
        user.firstName = value;
        break;
      case 'lastName':
        user.lastName = value;
        break;
      case 'languageCode':
        user.languageCode = value;
        break;
      default:
        throw new Error(`Unknown field: ${field}`);
    }

    await this.em.persistAndFlush(user);
  }

  /**
   * Validate profile field
   */
  private validateProfileField(
    field: string,
    value: string,
  ): { isValid: boolean; error?: string; sanitized?: unknown } {
    switch (field) {
      case 'username':
        return BotValidationUtil.validateUsername(value);
      case 'firstName':
      case 'lastName':
        return BotValidationUtil.validateUserInput(value, {
          type: 'text',
          minLength: 1,
          maxLength: 64,
          trim: true,
        });
      case 'languageCode':
        return BotValidationUtil.validateUserInput(value, {
          type: 'text',
          maxLength: 10,
          trim: true,
          toLowerCase: true,
        });
      default:
        return { isValid: false, error: 'Unknown field' };
    }
  }

  /**
   * Format profile view text
   */
  private formatProfileView(user: UserEntity): string {
    const statusEmoji = user.status === UserStatus.Active ? '✅' : user.status === UserStatus.Restricted ? '⚠️' : '🚫';
    const verifiedEmoji = user.isVerified ? '✅' : '❌';

    return (
      '<b>👤 Your Profile</b>\n\n' +
      `<b>Name:</b> ${user.firstName}${user.lastName ? ' ' + user.lastName : ''}\n` +
      `<b>Username:</b> ${user.username || 'Not set'}\n` +
      `<b>Status:</b> ${statusEmoji} ${user.status}\n` +
      `<b>Verified:</b> ${verifiedEmoji}\n` +
      `<b>Referrals:</b> ${user.referralCount}\n` +
      `<b>Member since:</b> ${user.createdAt.toLocaleDateString()}\n\n` +
      `<i>Use the buttons below to manage your profile.</i>`
    );
  }

  /**
   * Format profile details text
   */
  private formatProfileDetails(user: UserEntity): string {
    return (
      '<b>📋 Detailed Profile Information</b>\n\n' +
      `<b>User ID:</b> <code>${user.id}</code>\n` +
      `<b>Telegram ID:</b> <code>${user.telegramId}</code>\n` +
      `<b>Name:</b> ${user.firstName}${user.lastName ? ' ' + user.lastName : ''}\n` +
      `<b>Username:</b> ${user.username || 'Not set'}\n` +
      `<b>Language:</b> ${user.languageCode || 'Not set'}\n\n` +
      `<b>Account Status:</b>\n` +
      `• Status: ${user.status}\n` +
      `• Role: ${user.role}\n` +
      `• Active: ${user.isActive ? 'Yes' : 'No'}\n` +
      `• Verified: ${user.isVerified ? 'Yes' : 'No'}\n` +
      `• Admin: ${user.isAdmin ? 'Yes' : 'No'}\n\n` +
      `<b>Referral Information:</b>\n` +
      `• Total Referrals: ${user.referralCount}\n` +
      `• Referred By: ${user.referredBy || 'None'}\n\n` +
      `<b>Timestamps:</b>\n` +
      `• Created: ${user.createdAt.toLocaleString()}\n` +
      `• Updated: ${user.updatedAt.toLocaleString()}\n` +
      `• Last Active: ${user.lastActiveAt ? user.lastActiveAt.toLocaleString() : 'Never'}`
    );
  }

  /**
   * Create profile edit keyboard
   */
  private createProfileEditKeyboard() {
    const { InlineKeyboard } = require('grammy');

    return new InlineKeyboard()
      .text('✏️ First Name', 'profile:edit:firstName')
      .text('✏️ Last Name', 'profile:edit:lastName')
      .row()
      .text('✏️ Username', 'profile:edit:username')
      .text('🌐 Language', 'profile:edit:languageCode')
      .row()
      .text('« Back', 'menu:profile');
  }
}
