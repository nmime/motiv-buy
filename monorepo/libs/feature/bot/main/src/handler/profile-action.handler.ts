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
   *
   * Note: Auth middleware ensures ctx.user exists for authenticated routes
   */
  async handleProfileView(ctx: BotContext): Promise<void> {
    if (!ctx.user) {
      await ctx.reply(ctx.t('auth.authentication_required'));
      return;
    }

    const profileText = this.formatProfileView(ctx.user);
    const keyboard = this.menuHandler.createProfileMenuKeyboard();

    await this.messageService.sendOrEditMessage(ctx, {
      text: profileText,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });

    this.logger.log('Profile viewed', { userId: ctx.user.id, telegramId: ctx.user.telegramId });
  }

  /**
   * Handle profile edit initiation
   *
   * Note: Auth middleware ensures ctx.user exists for authenticated routes
   */
  async handleProfileEditStart(ctx: BotContext): Promise<void> {
    if (!ctx.user) {
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
  }

  /**
   * Handle profile field update
   *
   * Note: Auth middleware ensures ctx.user exists for authenticated routes
   */
  async handleProfileFieldUpdate(ctx: BotContext, field: string, value: string): Promise<void> {
    if (!ctx.user) {
      await ctx.reply(ctx.t('auth.authentication_required'));
      return;
    }

    // Validate input based on field type
    const validation = this.validateProfileField(field, value);

    if (!validation.isValid) {
      await ctx.reply(`❌ ${validation.error}\n\nPlease try again or use /cancel to abort.`);
      return;
    }

    // Update user field
    await this.updateUserField(ctx.user, field, validation.sanitized as string);

    await ctx.reply(`✅ Successfully updated ${field}!`);

    // Clear session state
    if (ctx.session) {
      ctx.session.conversationState = undefined;
      ctx.session.formData = {};
    }

    // Show updated profile
    await this.handleProfileView(ctx);

    this.logger.log('Profile updated', {
      userId: ctx.user.id,
      field,
      telegramId: ctx.user.telegramId,
    });
  }

  /**
   * Handle profile details view
   *
   * Note: Auth middleware ensures ctx.user exists for authenticated routes
   */
  async handleProfileDetails(ctx: BotContext): Promise<void> {
    if (!ctx.user) {
      await ctx.reply(ctx.t('auth.authentication_required'));
      return;
    }

    const detailsText = this.formatProfileDetails(ctx.user);
    const keyboard = this.menuHandler.createBackButton('menu:profile');

    await ctx.replyWithHTML(detailsText, { reply_markup: keyboard });
  }

  /**
   * Handle account verification
   *
   * Note: Auth middleware ensures ctx.user exists for authenticated routes
   */
  async handleVerification(ctx: BotContext): Promise<void> {
    if (!ctx.user) {
      await ctx.reply(ctx.t('auth.authentication_required'));
      return;
    }

    if (ctx.user.isVerified) {
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

    this.logger.log('Verification info viewed', { userId: ctx.user.id });
  }

  /**
   * Field update map for O(1) lookup performance
   */
  private readonly fieldUpdaters: Record<string, (user: UserEntity, value: string) => void> = {
    username: (user, value) => {
      user.username = value;
    },
    firstName: (user, value) => {
      user.firstName = value;
    },
    lastName: (user, value) => {
      user.lastName = value;
    },
    languageCode: (user, value) => {
      user.languageCode = value;
    },
  };

  /**
   * Update user field
   */
  private async updateUserField(user: UserEntity, field: string, value: string): Promise<void> {
    const updater = this.fieldUpdaters[field];

    if (!updater) {
      throw new Error(`Unknown field: ${field}`);
    }

    updater(user, value);
    await this.em.persistAndFlush(user);
  }

  /**
   * Field validator map for O(1) lookup performance
   */
  private readonly fieldValidators: Record<
    string,
    (value: string) => { isValid: boolean; error?: string; sanitized?: unknown }
  > = {
    username: (value) => BotValidationUtil.validateUsername(value),
    firstName: (value) =>
      BotValidationUtil.validateUserInput(value, {
        type: 'text',
        minLength: 1,
        maxLength: 64,
        trim: true,
      }),
    lastName: (value) =>
      BotValidationUtil.validateUserInput(value, {
        type: 'text',
        minLength: 1,
        maxLength: 64,
        trim: true,
      }),
    languageCode: (value) =>
      BotValidationUtil.validateUserInput(value, {
        type: 'text',
        maxLength: 10,
        trim: true,
        toLowerCase: true,
      }),
  };

  /**
   * Validate profile field
   */
  private validateProfileField(
    field: string,
    value: string,
  ): { isValid: boolean; error?: string; sanitized?: unknown } {
    const validator = this.fieldValidators[field];

    if (!validator) {
      return { isValid: false, error: 'Unknown field' };
    }

    return validator(value);
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
