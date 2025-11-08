/* eslint-disable @nx/enforce-module-boundaries */
/**
 * Settings Action Handler
 *
 * Handles user settings-related actions including language,
 * notifications, privacy, and preferences management.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import { EntityManager } from '@mikro-orm/core';
import { SettingType, UserEntity, UserSettingsEntity } from '@app/database';
import { MenuActionHandler } from './menu-action.handler';
import { BotValidationUtil } from '../util/bot-validation.util';
import { MessageService } from '../service/message.service';

interface UserPreferences {
  language: string;
  notifications: {
    balance: boolean;
    trade: boolean;
    referral: boolean;
    system: boolean;
    marketing: boolean;
  };
  privacy: {
    showProfile: boolean;
    showStats: boolean;
  };
}

@Injectable()
export class SettingsActionHandler {
  private readonly logger = new Logger(SettingsActionHandler.name);

  private readonly SUPPORTED_LANGUAGES = ['en', 'ru', 'uk', 'es', 'fr', 'de', 'zh'];

  constructor(
    private readonly em: EntityManager,
    private readonly menuHandler: MenuActionHandler,
    private readonly messageService: MessageService,
  ) {}

  /**
   * Handle settings view
   */
  async handleSettingsView(ctx: BotContext): Promise<void> {
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

      const preferences = await this.getUserPreferences(user.id);
      const settingsText = this.formatSettingsView(preferences);
      const keyboard = this.menuHandler.createSettingsMenuKeyboard();

      await this.messageService.sendOrEditMessage(ctx, {
        text: settingsText,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      this.logger.log('Settings viewed', { userId: user.id });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle language settings
   */
  async handleLanguageSettings(ctx: BotContext): Promise<void> {
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

      const currentLang = user.languageCode || 'en';
      const languageText = `🌐 <b>Language Settings</b>\n\nCurrent language: ${this.getLanguageName(currentLang)}\n\nSelect your preferred language:`;

      const languageKeyboard = this.createLanguageKeyboard(currentLang);

      await ctx.replyWithHTML(languageText, { reply_markup: languageKeyboard });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle language change
   */
  async handleLanguageChange(ctx: BotContext, languageCode: string): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      // Validate language code
      const validation = BotValidationUtil.validateUserInput(languageCode, {
        type: 'text',
        maxLength: 10,
        trim: true,
        toLowerCase: true,
      });

      if (!validation.isValid || !this.SUPPORTED_LANGUAGES.includes(validation.sanitized as string)) {
        await ctx.reply(ctx.t('common.errors.invalid_input'));

        return;
      }

      const user = await this.findUserByTelegramId(ctx.from.id.toString());

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      user.languageCode = validation.sanitized as string;
      await this.em.persistAndFlush(user);

      await ctx.reply(`✅ Language changed to ${this.getLanguageName(validation.sanitized as string)}!`);

      this.logger.log('Language changed', {
        userId: user.id,
        language: validation.sanitized,
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle notification settings
   */
  async handleNotificationSettings(ctx: BotContext): Promise<void> {
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

      const notificationPrefs = await this.getNotificationPreferences(user.id);
      const notificationText = this.formatNotificationSettings(notificationPrefs);
      const keyboard = this.createNotificationKeyboard(notificationPrefs);

      await ctx.replyWithHTML(notificationText, { reply_markup: keyboard });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle notification toggle
   */
  async handleNotificationToggle(ctx: BotContext, notificationType: string): Promise<void> {
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

      await this.toggleNotification(user.id, notificationType);

      await ctx.answerCallbackQuery(ctx.t('common.success.updated'));

      // Refresh notification settings view
      await this.handleNotificationSettings(ctx);

      this.logger.log('Notification toggled', {
        userId: user.id,
        type: notificationType,
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle preferences settings
   */
  async handlePreferencesSettings(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const preferencesText =
        '🎨 <b>Preferences</b>\n\n' +
        'Customize your bot experience:\n\n' +
        '• Display Mode: Compact / Detailed\n' +
        '• Currency Format: USD / EUR / RUB\n' +
        '• Timezone: Auto / Custom\n' +
        '• Date Format: DD/MM/YYYY / MM/DD/YYYY\n\n' +
        '<i>More preferences coming soon!</i>';

      const keyboard = this.menuHandler.createBackButton('menu:settings');

      await ctx.replyWithHTML(preferencesText, { reply_markup: keyboard });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle privacy settings
   */
  async handlePrivacySettings(ctx: BotContext): Promise<void> {
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

      const privacyPrefs = await this.getPrivacyPreferences(user.id);
      const privacyText = this.formatPrivacySettings(privacyPrefs);
      const keyboard = this.createPrivacyKeyboard(privacyPrefs);

      await ctx.replyWithHTML(privacyText, { reply_markup: keyboard });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Get user preferences
   */
  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    const user = await this.em.findOne(UserEntity, { id: userId });
    const settings = await this.em.find(UserSettingsEntity, { user: userId });

    const settingsMap = settings.reduce(
      (acc, setting) => {
        acc[setting.key] = setting.getValue();

        return acc;
      },
      {} as Record<string, any>,
    );

    return {
      language: user?.languageCode || 'en',
      notifications: {
        balance: settingsMap['notification_balance'] !== false,
        trade: settingsMap['notification_trade'] !== false,
        referral: settingsMap['notification_referral'] !== false,
        system: settingsMap['notification_system'] !== false,
        marketing: settingsMap['notification_marketing'] !== false,
      },
      privacy: {
        showProfile: settingsMap['privacy_show_profile'] !== false,
        showStats: settingsMap['privacy_show_stats'] !== false,
      },
    };
  }

  /**
   * Get notification preferences
   */
  private async getNotificationPreferences(userId: string) {
    const settings = await this.em.find(UserSettingsEntity, {
      user: userId,
      key: { $like: 'notification_%' },
    });

    return {
      balance: this.getSettingValue(settings, 'notification_balance', true),
      trade: this.getSettingValue(settings, 'notification_trade', true),
      referral: this.getSettingValue(settings, 'notification_referral', true),
      system: this.getSettingValue(settings, 'notification_system', true),
      marketing: this.getSettingValue(settings, 'notification_marketing', true),
    };
  }

  /**
   * Get privacy preferences
   */
  private async getPrivacyPreferences(userId: string) {
    const settings = await this.em.find(UserSettingsEntity, {
      user: userId,
      key: { $like: 'privacy_%' },
    });

    return {
      showProfile: this.getSettingValue(settings, 'privacy_show_profile', true),
      showStats: this.getSettingValue(settings, 'privacy_show_stats', true),
    };
  }

  /**
   * Get setting value
   */
  private getSettingValue(settings: UserSettingsEntity[], key: string, defaultValue: boolean): boolean {
    const setting = settings.find((s) => s.key === key);

    return setting ? (setting.getValue() as boolean) : defaultValue;
  }

  /**
   * Toggle notification
   */
  private async toggleNotification(userId: string, notificationType: string): Promise<void> {
    const key = `notification_${notificationType}`;
    let setting = await this.em.findOne(UserSettingsEntity, { user: userId, key });

    if (!setting) {
      const user = await this.em.getReference(UserEntity, userId);
      setting = new UserSettingsEntity({
        userId: user.id,
        key,
        value: 'false',
        type: SettingType.Boolean,
      });
    } else {
      const currentValue = setting.getValue() as boolean;
      setting.setValue(!currentValue);
    }

    await this.em.persistAndFlush(setting);
  }

  /**
   * Find user by Telegram ID
   */
  private async findUserByTelegramId(telegramId: string): Promise<UserEntity | null> {
    return await this.em.findOne(UserEntity, { telegramId });
  }

  /**
   * Get language name
   */
  private getLanguageName(code: string): string {
    const languages: Record<string, string> = {
      en: 'English',
      ru: 'Русский',
      uk: 'Українська',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
      zh: '中文',
    };

    return languages[code] || code;
  }

  /**
   * Format settings view
   */
  private formatSettingsView(preferences: UserPreferences): string {
    return (
      '<b>⚙️ Settings</b>\n\n' +
      `<b>🌐 Language:</b> ${this.getLanguageName(preferences.language)}\n\n` +
      `<b>🔔 Notifications:</b>\n` +
      `• Balance: ${preferences.notifications.balance ? '✅' : '❌'}\n` +
      `• Trade: ${preferences.notifications.trade ? '✅' : '❌'}\n` +
      `• Referral: ${preferences.notifications.referral ? '✅' : '❌'}\n` +
      `• System: ${preferences.notifications.system ? '✅' : '❌'}\n` +
      `• Marketing: ${preferences.notifications.marketing ? '✅' : '❌'}\n\n` +
      `<b>🔒 Privacy:</b>\n` +
      `• Show Profile: ${preferences.privacy.showProfile ? '✅' : '❌'}\n` +
      `• Show Stats: ${preferences.privacy.showStats ? '✅' : '❌'}\n\n` +
      `<i>Use the buttons below to manage your settings.</i>`
    );
  }

  /**
   * Format notification settings
   */
  private formatNotificationSettings(prefs: UserPreferences['notifications']): string {
    return (
      '<b>🔔 Notification Settings</b>\n\n' +
      `Balance Changes: ${prefs.balance ? '✅ Enabled' : '❌ Disabled'}\n` +
      `Trade Notifications: ${prefs.trade ? '✅ Enabled' : '❌ Disabled'}\n` +
      `Referral Updates: ${prefs.referral ? '✅ Enabled' : '❌ Disabled'}\n` +
      `System Messages: ${prefs.system ? '✅ Enabled' : '❌ Disabled'}\n` +
      `Marketing: ${prefs.marketing ? '✅ Enabled' : '❌ Disabled'}\n\n` +
      `<i>Tap on an option to toggle it.</i>`
    );
  }

  /**
   * Format privacy settings
   */
  private formatPrivacySettings(prefs: UserPreferences['privacy']): string {
    return (
      '<b>🔒 Privacy Settings</b>\n\n' +
      `Show Profile: ${prefs.showProfile ? '✅ Public' : '❌ Private'}\n` +
      `Show Statistics: ${prefs.showStats ? '✅ Public' : '❌ Private'}\n\n` +
      `<i>Control who can see your information.</i>`
    );
  }

  /**
   * Create language keyboard
    // eslint-disable-next-line @typescript-eslint/no-require-imports
   */
  private createLanguageKeyboard(currentLang: string) {
    const { InlineKeyboard } = require('grammy');
    const keyboard = new InlineKeyboard();

    const languages = [
      { code: 'en', name: 'English' },
      { code: 'ru', name: 'Русский' },
      { code: 'uk', name: 'Українська' },
      { code: 'es', name: 'Español' },
      { code: 'fr', name: 'Français' },
      { code: 'de', name: 'Deutsch' },
    ];

    languages.forEach((lang) => {
      const marker = lang.code === currentLang ? '✅ ' : '';
      keyboard.text(`${marker}${lang.name}`, `settings:lang:${lang.code}`).row();
    });

    keyboard.text('« Back', 'menu:settings');

    return keyboard;
  }

  /**
    // eslint-disable-next-line @typescript-eslint/no-require-imports
   * Create notification keyboard
   */
  private createNotificationKeyboard(prefs: UserPreferences['notifications']) {
    const { InlineKeyboard } = require('grammy');

    return new InlineKeyboard()
      .text(`${prefs.balance ? '✅' : '❌'} Balance`, 'settings:notify:balance')
      .text(`${prefs.trade ? '✅' : '❌'} Trade`, 'settings:notify:trade')
      .row()
      .text(`${prefs.referral ? '✅' : '❌'} Referral`, 'settings:notify:referral')
      .text(`${prefs.system ? '✅' : '❌'} System`, 'settings:notify:system')
      .row()
      .text(`${prefs.marketing ? '✅' : '❌'} Marketing`, 'settings:notify:marketing')
      .row()
      .text('« Back', 'menu:settings');
  }

  /**
   * Create privacy keyboard
   */
  private createPrivacyKeyboard(prefs: UserPreferences['privacy']) {
    const { InlineKeyboard } = require('grammy');

    return new InlineKeyboard()
      .text(`${prefs.showProfile ? '✅' : '❌'} Profile`, 'settings:privacy:profile')
      .text(`${prefs.showStats ? '✅' : '❌'} Stats`, 'settings:privacy:stats')
      .row()
      .text('« Back', 'menu:settings');
  }
}
