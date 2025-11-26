/**
 * Profile Feature Keyboards
 *
 * Inline keyboard builders for profile-related features.
 * All keyboards accept BotContext for i18n translations.
 */

import { InlineKeyboard } from 'grammy';
import { BotContext } from '@app/feature-bot-shared';

/**
 * Create profile menu keyboard
 */
export function createProfileMenuKeyboard(ctx: BotContext): InlineKeyboard {
  return new InlineKeyboard()
    .text(ctx.t('menu.profile.details'), 'profile:details')
    .row()
    .text(ctx.t('common.back'), 'menu:main');
}

/**
 * Create back to profile keyboard
 */
export function createBackToProfileKeyboard(ctx: BotContext): InlineKeyboard {
  return new InlineKeyboard().text(ctx.t('common.back'), 'profile:view');
}

/**
 * Create profile stats menu keyboard
 */
export function createProfileStatsKeyboard(ctx: BotContext): InlineKeyboard {
  return new InlineKeyboard()
    .text(ctx.t('common.overview'), 'profile:stats:overview')
    .text(ctx.t('balance.recent_activity'), 'profile:stats:activity')
    .row()
    .text(ctx.t('balance.earned'), 'profile:stats:earnings')
    .text(ctx.t('statistic.performance'), 'profile:stats:performance')
    .row()
    .text(ctx.t('common.back'), 'profile:view');
}

/**
 * Create profile security menu keyboard
 */
export function createProfileSecurityKeyboard(ctx: BotContext): InlineKeyboard {
  return new InlineKeyboard()
    .text(ctx.t('profile.password_change'), 'profile:password')
    .text(ctx.t('profile.email_security'), 'profile:email_security')
    .row()
    .text(ctx.t('bot.settings.two_fa'), 'profile:2fa')
    .text(ctx.t('bot.settings.login_history'), 'profile:login_history')
    .row()
    .text(ctx.t('common.back'), 'menu:profile');
}
