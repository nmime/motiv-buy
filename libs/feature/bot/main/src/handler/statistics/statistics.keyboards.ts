/**
 * Statistics Feature Keyboards
 *
 * Inline keyboard builders for statistics-related features.
 * All keyboards accept BotContext for i18n translations.
 */

import { InlineKeyboard } from 'grammy';
import { BotContext } from '@app/feature-bot-shared';

/**
 * Create statistics menu keyboard
 */
export function createStatisticsMenuKeyboard(ctx: BotContext): InlineKeyboard {
  return new InlineKeyboard()
    .text(ctx.t('menu.stats.overview'), 'stats:overview')
    .text(ctx.t('menu.stats.detailed'), 'stats:detailed')
    .row()
    .text(ctx.t('menu.stats.traffic'), 'stats:traffic')
    .text(ctx.t('menu.stats.earnings'), 'stats:earnings')
    .row()
    .text(ctx.t('common.back'), 'menu:main');
}

/**
 * Create back to statistics keyboard
 */
export function createBackToStatisticsKeyboard(ctx: BotContext): InlineKeyboard {
  return new InlineKeyboard().text(ctx.t('common.back'), 'menu:statistics');
}
