/**
 * Settings Handler
 *
 * Grammy Composer for settings-related callback queries.
 * Handles language, notifications, privacy, and preferences management.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Composer } from 'grammy';
import { EntityManager } from '@mikro-orm/core';
import { AuthenticatedBotContext, BotContext, isAuthenticated } from '@app/feature-bot-shared';
import { SettingType, UserEntity, UserSettingsEntity } from '@app/database';
import { BotValidationUtil } from '../../util/bot-validation.util';
import { MessageService } from '../../service/message.service';
import {
  createSettingsMenuKeyboard,
  createLanguageKeyboard,
  createNotificationKeyboard,
  createPrivacyKeyboard,
  createBackToSettingsKeyboard,
} from './settings.keyboards';

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
export class SettingsHandler {
  private readonly logger = new Logger(SettingsHandler.name);
  private readonly supportedLanguages = ['en', 'ru', 'uk', 'es', 'fr', 'de', 'zh'];
  private composer: Composer<BotContext>;

  constructor(
    private readonly em: EntityManager,
    private readonly messageService: MessageService,
  ) {
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
    // Settings view
    this.composer.callbackQuery('menu:settings', (ctx) =>
      this.withAuth(ctx, (authCtx) => this.handleSettingsView(authCtx)),
    );

    // Language settings
    this.composer.callbackQuery('settings:language', (ctx) =>
      this.withAuth(ctx, (authCtx) => this.handleLanguageSettings(authCtx)),
    );

    this.composer.callbackQuery(/^settings:lang:(.+)$/, (ctx) => {
      const match = ctx.callbackQuery.data.match(/^settings:lang:(.+)$/);
      const langCode = match?.[1] ?? 'en';

      return this.withAuth(ctx, (authCtx) => this.handleLanguageChange(authCtx, langCode));
    });

    // Notification settings
    this.composer.callbackQuery('settings:notifications', (ctx) =>
      this.withAuth(ctx, (authCtx) => this.handleNotificationSettings(authCtx)),
    );

    this.composer.callbackQuery(/^settings:notify:(.+)$/, (ctx) => {
      const match = ctx.callbackQuery.data.match(/^settings:notify:(.+)$/);
      const notificationType = match?.[1] ?? '';

      return this.withAuth(ctx, (authCtx) => this.handleNotificationToggle(authCtx, notificationType));
    });

    // Privacy settings
    this.composer.callbackQuery('settings:privacy', (ctx) =>
      this.withAuth(ctx, (authCtx) => this.handlePrivacySettings(authCtx)),
    );

    // Preferences settings
    this.composer.callbackQuery('settings:preferences', (ctx) =>
      this.withAuth(ctx, (authCtx) => this.handlePreferencesSettings(authCtx)),
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
   * Handle settings view
   */
  async handleSettingsView(ctx: AuthenticatedBotContext): Promise<void> {
    const preferences = await this.getUserPreferences(ctx.user.id);
    const settingsText = this.formatSettingsView(preferences, ctx);
    const keyboard = createSettingsMenuKeyboard(ctx);

    await this.messageService.sendOrEditMessage(ctx, {
      text: settingsText,
      replyMarkup: keyboard,
    });

    this.logger.log('Settings viewed', { userId: ctx.user.id });
  }

  /**
   * Handle language settings
   */
  async handleLanguageSettings(ctx: AuthenticatedBotContext): Promise<void> {
    const currentLang = ctx.user.languageCode ?? 'en';
    const languageText =
      `🌐 <b>${ctx.t('settings.language_title')}</b>\n\n` +
      `${ctx.t('settings.current_language')}: ${this.getLanguageName(currentLang)}\n\n` +
      `${ctx.t('settings.select_language')}`;

    const languageKeyboard = createLanguageKeyboard(ctx, currentLang);

    await this.messageService.sendOrEditMessage(ctx, {
      text: languageText,
      replyMarkup: languageKeyboard,
    });
  }

  /**
   * Handle language change
   */
  async handleLanguageChange(ctx: AuthenticatedBotContext, languageCode: string): Promise<void> {
    const validation = BotValidationUtil.validateUserInput(languageCode, {
      type: 'text',
      maxLength: 10,
      trim: true,
      toLowerCase: true,
    });

    if (!validation.isValid || !this.supportedLanguages.includes(validation.sanitized as string)) {
      await ctx.reply(ctx.t('common.errors.invalid_input'));

      return;
    }

    ctx.user.languageCode = validation.sanitized as string;
    await this.em.persistAndFlush(ctx.user);

    await ctx.reply(
      ctx.t('settings.language_changed', {
        default: `✅ Language changed to ${this.getLanguageName(validation.sanitized as string)}!`,
        language: this.getLanguageName(validation.sanitized as string),
      }),
    );

    this.logger.log('Language changed', { userId: ctx.user.id, language: validation.sanitized });
  }

  /**
   * Handle notification settings
   */
  async handleNotificationSettings(ctx: AuthenticatedBotContext): Promise<void> {
    const notificationPrefs = await this.getNotificationPreferences(ctx.user.id);
    const notificationText = this.formatNotificationSettings(notificationPrefs, ctx);
    const keyboard = createNotificationKeyboard(ctx, notificationPrefs);

    await this.messageService.sendOrEditMessage(ctx, {
      text: notificationText,
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle notification toggle
   */
  async handleNotificationToggle(ctx: AuthenticatedBotContext, notificationType: string): Promise<void> {
    await this.toggleNotification(ctx.user.id, notificationType);
    await ctx.answerCallbackQuery(ctx.t('common.success.updated'));
    await this.handleNotificationSettings(ctx);

    this.logger.log('Notification toggled', { userId: ctx.user.id, type: notificationType });
  }

  /**
   * Handle preferences settings
   */
  async handlePreferencesSettings(ctx: AuthenticatedBotContext): Promise<void> {
    const preferencesText =
      `🎨 <b>${ctx.t('settings.preferences_title')}</b>\n\n` +
      `${ctx.t('settings.preferences_description')}\n\n` +
      `• ${ctx.t('settings.display_mode')}: Compact / Detailed\n` +
      `• ${ctx.t('settings.currency_format')}: USD / EUR / RUB\n` +
      `• ${ctx.t('settings.timezone')}: Auto / Custom\n` +
      `• ${ctx.t('settings.date_format')}: DD/MM/YYYY / MM/DD/YYYY\n\n` +
      `<i>${ctx.t('settings.coming_soon')}</i>`;

    const keyboard = createBackToSettingsKeyboard(ctx);

    await this.messageService.sendOrEditMessage(ctx, {
      text: preferencesText,
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle privacy settings
   */
  async handlePrivacySettings(ctx: AuthenticatedBotContext): Promise<void> {
    const privacyPrefs = await this.getPrivacyPreferences(ctx.user.id);
    const privacyText = this.formatPrivacySettings(privacyPrefs, ctx);
    const keyboard = createPrivacyKeyboard(ctx, privacyPrefs);

    await this.messageService.sendOrEditMessage(ctx, {
      text: privacyText,
      replyMarkup: keyboard,
    });
  }

  /**
   * Get user preferences
   */
  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    const user = await this.em.findOne(UserEntity, { id: userId });
    const settings = await this.em.find(UserSettingsEntity, { user: userId });

    const settingsMap = settings.reduce(
      (acc, setting) =>
        Object.assign({}, acc, {
          [setting.key]: setting.getValue(),
        }),
      {} as Record<string, unknown>,
    );

    return {
      language: user?.languageCode ?? 'en',
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

    return languages[code] ?? code;
  }

  /**
   * Format settings view
   */
  private formatSettingsView(preferences: UserPreferences, ctx: AuthenticatedBotContext): string {
    return (
      `<b>⚙️ ${ctx.t('settings.title')}</b>\n\n` +
      `<b>🌐 ${ctx.t('settings.language')}:</b> ${this.getLanguageName(preferences.language)}\n\n` +
      `<b>🔔 ${ctx.t('settings.notifications')}:</b>\n` +
      `• ${ctx.t('settings.balance')}: ${preferences.notifications.balance ? '✅' : '❌'}\n` +
      `• ${ctx.t('settings.trade')}: ${preferences.notifications.trade ? '✅' : '❌'}\n` +
      `• ${ctx.t('settings.referral')}: ${preferences.notifications.referral ? '✅' : '❌'}\n` +
      `• ${ctx.t('settings.system')}: ${preferences.notifications.system ? '✅' : '❌'}\n` +
      `• ${ctx.t('settings.marketing')}: ${preferences.notifications.marketing ? '✅' : '❌'}\n\n` +
      `<b>🔒 ${ctx.t('settings.privacy')}:</b>\n` +
      `• ${ctx.t('settings.show_profile')}: ${preferences.privacy.showProfile ? '✅' : '❌'}\n` +
      `• ${ctx.t('settings.show_stats')}: ${preferences.privacy.showStats ? '✅' : '❌'}\n\n` +
      `<i>${ctx.t('settings.use_buttons')}</i>`
    );
  }

  /**
   * Format notification settings
   */
  private formatNotificationSettings(prefs: UserPreferences['notifications'], ctx: AuthenticatedBotContext): string {
    return (
      `<b>🔔 ${ctx.t('settings.notification_title')}</b>\n\n` +
      `${ctx.t('settings.balance_changes')}: ${prefs.balance ? '✅' : '❌'}\n` +
      `${ctx.t('settings.trade_notifications')}: ${prefs.trade ? '✅' : '❌'}\n` +
      `${ctx.t('settings.referral_updates')}: ${prefs.referral ? '✅' : '❌'}\n` +
      `${ctx.t('settings.system_messages')}: ${prefs.system ? '✅' : '❌'}\n` +
      `${ctx.t('settings.marketing')}: ${prefs.marketing ? '✅' : '❌'}\n\n` +
      `<i>${ctx.t('settings.tap_to_toggle')}</i>`
    );
  }

  /**
   * Format privacy settings
   */
  private formatPrivacySettings(prefs: UserPreferences['privacy'], ctx: AuthenticatedBotContext): string {
    const publicText = ctx.t('settings.public');
    const privateText = ctx.t('settings.private');

    const profileStatus = prefs.showProfile ? '✅ ' + publicText : '❌ ' + privateText;
    const statsStatus = prefs.showStats ? '✅ ' + publicText : '❌ ' + privateText;

    return (
      `<b>🔒 ${ctx.t('settings.privacy_title')}</b>\n\n` +
      `${ctx.t('settings.show_profile')}: ${profileStatus}\n` +
      `${ctx.t('settings.show_statistics')}: ${statsStatus}\n\n` +
      `<i>${ctx.t('settings.control_visibility')}</i>`
    );
  }
}
