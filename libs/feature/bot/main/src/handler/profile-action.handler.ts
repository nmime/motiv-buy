/**
 * Profile Action Handler
 *
 * Handles user profile-related actions including viewing, editing,
 * and verification of user profiles.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedBotContext } from '@app/feature-bot-shared';
import { EntityManager } from '@mikro-orm/core';
import { InlineKeyboard } from 'grammy';
import { UserEntity, UserRole, UserStatus } from '@app/database';
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
   * Note: This handler must be wrapped with protectHandler()
   * Context type guarantees user exists - no null checks or assertions needed
   */
  async handleProfileView(ctx: AuthenticatedBotContext): Promise<void> {
    // ctx.user is GUARANTEED by AuthenticatedBotContext type - no ! needed
    const profileText = this.formatProfileView(ctx.user);
    const keyboard = this.menuHandler.createProfileMenuKeyboard(ctx);

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
   * Note: This handler must be wrapped with protectHandler()
   */
  async handleProfileEditStart(ctx: AuthenticatedBotContext): Promise<void> {
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
   * Note: This handler must be wrapped with protectHandler()
   */
  async handleProfileFieldUpdate(ctx: AuthenticatedBotContext, field: string, value: string): Promise<void> {
    // Validate input based on field type
    const validation = this.validateProfileField(field, value);

    if (!validation.isValid) {
      await ctx.reply(`❌ ${validation.error}\n\nPlease try again or use /cancel to abort.`);

      return;
    }

    // Update user field - ctx.user is GUARANTEED by AuthenticatedBotContext
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
   * Note: This handler must be wrapped with protectHandler()
   */
  async handleProfileDetails(ctx: AuthenticatedBotContext): Promise<void> {
    const detailsText = this.formatProfileDetails(ctx.user);
    const keyboard = this.menuHandler.createBackButton('menu:profile', ctx.t('common.back'));

    await ctx.replyWithHTML(detailsText, { reply_markup: keyboard });
  }

  /**
   * Handle account verification
   *
   * Note: This handler must be wrapped with protectHandler()
   */
  async handleVerification(ctx: AuthenticatedBotContext): Promise<void> {
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
  private readonly fieldUpdaters: Record<string, keyof UserEntity> = {
    username: 'username',
    firstName: 'firstName',
    lastName: 'lastName',
    languageCode: 'languageCode',
  };

  /**
   * Update user field
   */
  private async updateUserField(user: UserEntity, field: string, value: string): Promise<void> {
    const fieldName = this.fieldUpdaters[field];

    if (!fieldName) {
      throw new Error(`Unknown field: ${field}`);
    }

    Object.assign(user, { [fieldName]: value });
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
    const statusEmojiMap: Record<UserStatus, string> = {
      [UserStatus.Active]: '✅',
      [UserStatus.Restricted]: '⚠️',
      [UserStatus.Banned]: '🚫',
    };

    const statusEmoji = statusEmojiMap[user.status] || '❓';

    return (
      '<b>👤 Your Profile</b>\n\n' +
      `<b>Name:</b> ${user.firstName}${user.lastName ? ' ' + user.lastName : ''}\n` +
      `<b>Username:</b> ${user.username || 'Not set'}\n` +
      `<b>Status:</b> ${statusEmoji} ${user.status}\n` +
      `<b>Referrals:</b> ${user.referralCount}\n` +
      `<b>Member since:</b> ${user.createdAt.toLocaleDateString()}\n\n` +
      `<i>Use the buttons below to manage your profile.</i>`
    );
  }

  /**
   * Format profile details text
   */
  private formatProfileDetails(user: UserEntity): string {
    const isActive = user.status === UserStatus.Active;
    const isAdmin = user.role !== UserRole.User;

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
      `• Active: ${isActive ? 'Yes' : 'No'}\n` +
      `• Admin: ${isAdmin ? 'Yes' : 'No'}\n\n` +
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
