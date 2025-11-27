/**
 * Balance Feature Keyboards
 *
 * Inline keyboard builders for balance-related features.
 * All keyboards accept BotContext for i18n translations.
 * Currency data comes from the database, not hardcoded.
 */

import { InlineKeyboard } from 'grammy';
import { BotContext } from '@app/feature-bot-shared';
import { UserBalanceEntity } from '@app/database';
import { decimal } from '@app/common-shared';

/**
 * Currency data for keyboard display (from database)
 */
export interface CurrencyDisplayData {
  code: string;
  symbol: string;
  name: string;
}

/**
 * Create balance menu keyboard
 */
export function createBalanceMenuKeyboard(ctx: BotContext): InlineKeyboard {
  return new InlineKeyboard()
    .text(ctx.t('balance.current'), 'balance:view')
    .text(ctx.t('balance.history'), 'balance:history')
    .row()
    .text(ctx.t('balance.withdraw'), 'balance:withdraw')
    .text(ctx.t('balance.deposit'), 'balance:deposit')
    .row()
    .text(ctx.t('common.back'), 'menu:main');
}

/**
 * Create deposit currency selection keyboard with database currencies
 */
export function createDepositCurrencyKeyboard(ctx: BotContext, currencies: CurrencyDisplayData[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const buttonsPerRow = 3;

  currencies.forEach((currency, index) => {
    const label = `${currency.symbol} ${currency.code}`;
    keyboard.text(label, `deposit:currency:${currency.code}`);
    if ((index + 1) % buttonsPerRow === 0) {
      keyboard.row();
    }
  });

  if (currencies.length % buttonsPerRow !== 0) {
    keyboard.row();
  }

  keyboard.text(ctx.t('common.back'), 'balance:view');

  return keyboard;
}

/**
 * Create withdrawal currency selection keyboard
 */
export async function createWithdrawCurrencyKeyboard(
  ctx: BotContext,
  balances: UserBalanceEntity[],
): Promise<InlineKeyboard> {
  const keyboard = new InlineKeyboard();

  for (const balance of balances) {
    // eslint-disable-next-line no-await-in-loop -- MikroORM lazy reference loading must be sequential
    const currency = await balance.currency.load();
    if (!currency) {
      continue;
    }

    const availableBalance = decimal(balance.getAvailableBalance());
    if (availableBalance.greaterThan(0)) {
      keyboard.text(`${currency.symbol ?? currency.code} ${currency.code}`, `withdraw:currency:${currency.id}`).row();
    }
  }

  keyboard.text(ctx.t('common.cancel'), 'menu:balance');

  return keyboard;
}

/**
 * Create transaction history pagination keyboard
 */
export function createHistoryPaginationKeyboard(ctx: BotContext, page: number, totalPages: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (page > 1) {
    keyboard.text(ctx.t('common.previous'), `balance:history:${page - 1}`);
  }

  if (page < totalPages) {
    keyboard.text(ctx.t('common.next'), `balance:history:${page + 1}`);
  }

  keyboard.row();
  keyboard.text(ctx.t('common.back'), 'menu:balance');

  return keyboard;
}

/**
 * Create deposit amount confirmation keyboard
 */
export function createDepositConfirmKeyboard(
  ctx: BotContext,
  payUrl: string,
  amount: string,
  currency: string,
): InlineKeyboard {
  return new InlineKeyboard()
    .url(ctx.t('balance.deposit_pay_button', { amount, currency }), payUrl)
    .row()
    .text(ctx.t('common.back'), 'balance:view');
}

/**
 * Create simple back button keyboard
 */
export function createBackToBalanceKeyboard(ctx: BotContext): InlineKeyboard {
  return new InlineKeyboard().text(ctx.t('common.back'), 'balance:view');
}

/**
 * Create back to deposit keyboard
 */
export function createBackToDepositKeyboard(ctx: BotContext): InlineKeyboard {
  return new InlineKeyboard().text(ctx.t('common.back'), 'balance:deposit');
}
