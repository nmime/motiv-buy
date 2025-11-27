/**
 * Settings Feature Keyboards
 *
 * Inline keyboard builders for settings-related features.
 * All keyboards accept BotContext for i18n translations.
 */

import { InlineKeyboard } from 'grammy';
import { BotContext } from '@app/feature-bot-shared';

interface NotificationPreferences {
  balance: boolean;
  trade: boolean;
  referral: boolean;
  system: boolean;
  marketing: boolean;
}

interface PrivacyPreferences {
  showProfile: boolean;
  showStats: boolean;
}

/**
 * Create settings menu keyboard
 */
export function createSettingsMenuKeyboard(ctx: BotContext): InlineKeyboard {
  return new InlineKeyboard()
    .text(ctx.t('menu.settings.language'), 'settings:language')
    .text(ctx.t('menu.settings.notifications'), 'settings:notifications')
    .row()
    .text(ctx.t('menu.settings.preferences'), 'settings:preferences')
    .text(ctx.t('menu.settings.privacy'), 'settings:privacy')
    .row()
    .text(ctx.t('common.back'), 'menu:main');
}

/**
 * Create language selection keyboard
 */
export function createLanguageKeyboard(ctx: BotContext, currentLang: string): InlineKeyboard {
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

  keyboard.text(ctx.t('common.back'), 'menu:settings');

  return keyboard;
}

/**
 * Create notification settings keyboard
 */
export function createNotificationKeyboard(ctx: BotContext, prefs: NotificationPreferences): InlineKeyboard {
  return new InlineKeyboard()
    .text(`${prefs.balance ? '✅' : '❌'} ${ctx.t('settings.balance')}`, 'settings:notify:balance')
    .text(`${prefs.trade ? '✅' : '❌'} ${ctx.t('settings.trade')}`, 'settings:notify:trade')
    .row()
    .text(`${prefs.referral ? '✅' : '❌'} ${ctx.t('settings.referral')}`, 'settings:notify:referral')
    .text(`${prefs.system ? '✅' : '❌'} ${ctx.t('settings.system')}`, 'settings:notify:system')
    .row()
    .text(`${prefs.marketing ? '✅' : '❌'} ${ctx.t('settings.marketing')}`, 'settings:notify:marketing')
    .row()
    .text(ctx.t('common.back'), 'menu:settings');
}

/**
 * Create privacy settings keyboard
 */
export function createPrivacyKeyboard(ctx: BotContext, prefs: PrivacyPreferences): InlineKeyboard {
  return new InlineKeyboard()
    .text(`${prefs.showProfile ? '✅' : '❌'} ${ctx.t('settings.profile')}`, 'settings:privacy:profile')
    .text(`${prefs.showStats ? '✅' : '❌'} ${ctx.t('settings.stats')}`, 'settings:privacy:stats')
    .row()
    .text(ctx.t('common.back'), 'menu:settings');
}

/**
 * Create back to settings keyboard
 */
export function createBackToSettingsKeyboard(ctx: BotContext): InlineKeyboard {
  return new InlineKeyboard().text(ctx.t('common.back'), 'menu:settings');
}
