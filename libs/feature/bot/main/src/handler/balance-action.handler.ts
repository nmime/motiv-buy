/**
 * Balance Action Handler
 *
 * Handles user balance-related actions including viewing balances,
 * transaction history, deposits, and withdrawals.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedBotContext } from '@app/feature-bot-shared';
import { EntityManager } from '@mikro-orm/core';
import {
  UserBalanceEntity,
  UserBalanceHistoryEntity,
  ProviderCurrencyRepository,
  ProviderCurrencyEntity,
  CurrencyCode,
  TransactionType,
} from '@app/database';
import { MenuActionHandler } from './menu-action.handler';
import { decimal, lessThan, toDisplayString, toError } from '@app/common-shared';
import { MessageService } from '../service/message.service';
import { InlineKeyboard } from 'grammy';
import { PaymentService } from '@app/feature-payment-main';

@Injectable()
export class BalanceActionHandler {
  private readonly logger = new Logger(BalanceActionHandler.name);

  constructor(
    private readonly em: EntityManager,
    private readonly menuHandler: MenuActionHandler,
    private readonly messageService: MessageService,
    private readonly paymentService: PaymentService,
    private readonly providerCurrencyRepo: ProviderCurrencyRepository,
  ) {}

  /**
   * Handle balance view action
   */
  async handleBalanceView(ctx: AuthenticatedBotContext): Promise<void> {
    try {
      const balances = await this.getUserBalances(ctx.user.id);
      const balanceText = await this.formatBalanceView(ctx, balances);
      const keyboard = this.menuHandler.createBalanceMenuKeyboard(ctx);

      await this.messageService.sendOrEditMessage(ctx, {
        text: balanceText,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      this.logger.log('Balance viewed', { userId: ctx.user.id });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, toError(error));
    }
  }

  /**
   * Handle transaction history view
   */
  async handleTransactionHistory(ctx: AuthenticatedBotContext, page = 1): Promise<void> {
    try {
      const limit = 10;
      const offset = (page - 1) * limit;
      const em = this.em.fork();

      const [transactions, total] = await em.findAndCount(
        UserBalanceHistoryEntity,
        { user: ctx.user.id },
        {
          orderBy: { createdAt: 'DESC' },
          limit,
          offset,
          populate: ['currency'],
        },
      );

      if (transactions.length === 0) {
        const backKeyboard = new InlineKeyboard().text(ctx.t('common.back'), 'balance:view');
        await this.messageService.sendOrEditMessage(ctx, {
          text: ctx.t('balance.no_transactions'),
          replyMarkup: backKeyboard,
        });

        return;
      }

      const totalPages = Math.ceil(total / limit);
      const historyText = await this.formatTransactionHistory(ctx, transactions, page, totalPages);

      const keyboard = new InlineKeyboard();
      if (page > 1) {
        keyboard.text(ctx.t('common.previous'), `balance:history:${page - 1}`);
      }

      if (page < totalPages) {
        keyboard.text(ctx.t('common.next'), `balance:history:${page + 1}`);
      }

      keyboard.row();
      keyboard.text(ctx.t('common.back'), 'menu:balance');

      await this.messageService.sendOrEditMessage(ctx, {
        text: historyText,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      this.logger.log('Transaction history viewed', { userId: ctx.user.id, page, total });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, toError(error));
    }
  }

  /**
   * Handle withdrawal initiation
   */
  async handleWithdrawalStart(ctx: AuthenticatedBotContext): Promise<void> {
    try {
      const balances = await this.getUserBalances(ctx.user.id);
      const availableBalance = balances.length > 0 ? balances[0].getAvailableBalance() : decimal(0);

      if (lessThan(availableBalance, decimal(10))) {
        await ctx.answerCallbackQuery({
          text: ctx.t('balance.insufficient_funds'),
          show_alert: true,
        });

        return;
      }

      if (ctx.session) {
        ctx.session.conversationState = 'withdrawal';
        ctx.session.formData = { step: 'select_currency' };
      }

      const currencyKeyboard = await this.createCurrencySelectionKeyboard(ctx, balances);

      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('balance.withdrawal_prompt'),
        parseMode: 'HTML',
        replyMarkup: currencyKeyboard,
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, toError(error));
    }
  }

  /**
   * Handle deposit initiation - shows available currencies for deposit
   */
  async handleDepositStart(ctx: AuthenticatedBotContext): Promise<void> {
    try {
      const keyboard = await this.createDepositCurrencyKeyboard(ctx);

      const depositText = ctx.t('balance.deposit_info_title') + '\n\n' + ctx.t('balance.deposit_select_currency');

      await this.messageService.sendOrEditMessage(ctx, {
        text: depositText,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      this.logger.log('Deposit currency selection viewed', { userId: ctx.user.id });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, toError(error));
    }
  }

  /**
   * Handle deposit currency selection - prompts for amount input
   */
  async handleDepositCurrency(ctx: AuthenticatedBotContext, currency: CurrencyCode): Promise<void> {
    try {
      if (ctx.session) {
        ctx.session.conversationState = 'deposit_amount';
        ctx.session.formData = { currency, step: 'enter_amount' };
      }

      const keyboard = new InlineKeyboard().text(ctx.t('common.back'), 'balance:deposit');

      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('balance.deposit_enter_amount', { currency, min: '1' }),
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      this.logger.log('Deposit amount input prompted', { userId: ctx.user.id, currency });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, toError(error));
    }
  }

  /**
   * Handle deposit amount submission - creates payment invoice
   */
  async handleDepositAmount(ctx: AuthenticatedBotContext, amount: string): Promise<void> {
    try {
      const currency = ctx.session?.formData?.currency as CurrencyCode | undefined;

      if (!currency) {
        await ctx.answerCallbackQuery({
          text: ctx.t('balance.deposit_error'),
          show_alert: true,
        });

        return this.handleDepositStart(ctx);
      }

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        await ctx.reply(ctx.t('balance.deposit_amount_invalid'));

        return;
      }

      if (amountNum < 1) {
        await ctx.reply(ctx.t('balance.deposit_amount_too_low', { min: '1', currency }));

        return;
      }

      const result = await this.paymentService.createTopUp(ctx.user.id, {
        amount,
        currency,
        description: `Deposit ${amount} ${currency}`,
      });

      if (result.err) {
        this.logger.error('Failed to create deposit invoice', { error: result.val, userId: ctx.user.id });
        await ctx.reply(ctx.t('balance.deposit_error'));

        return;
      }

      const invoice = result.val;

      if (ctx.session) {
        ctx.session.conversationState = undefined;
        ctx.session.formData = undefined;
      }

      const keyboard = new InlineKeyboard()
        .url(ctx.t('balance.deposit_pay_button', { amount, currency }), invoice.payUrl)
        .row()
        .text(ctx.t('common.back'), 'balance:view');

      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('balance.deposit_success', { amount, currency }),
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      this.logger.log('Deposit invoice created', {
        userId: ctx.user.id,
        invoiceId: invoice.id,
        amount,
        currency,
      });
    } catch (error) {
      this.logger.error('Error handling deposit amount', { error: toError(error) });
      await ctx.reply(ctx.t('balance.deposit_error'));
    }
  }

  /**
   * Currency display configuration
   */
  private readonly currencyConfig: Record<string, { emoji: string; label: string }> = {
    [CurrencyCode.Usdt]: { emoji: '💵', label: 'USDT' },
    [CurrencyCode.Ton]: { emoji: '💎', label: 'TON' },
    [CurrencyCode.Btc]: { emoji: '₿', label: 'BTC' },
    [CurrencyCode.Eth]: { emoji: 'Ξ', label: 'ETH' },
    [CurrencyCode.Usdc]: { emoji: '💵', label: 'USDC' },
    [CurrencyCode.Bnb]: { emoji: '🔶', label: 'BNB' },
    [CurrencyCode.Trx]: { emoji: '🔷', label: 'TRX' },
  };

  /**
   * Add currency buttons to keyboard in rows of 3
   */
  private addCurrencyButtons(keyboard: InlineKeyboard, currencies: CurrencyCode[]): void {
    const buttonsPerRow = 3;

    currencies.forEach((code, index) => {
      const config = this.currencyConfig[code];
      if (config) {
        keyboard.text(`${config.emoji} ${config.label}`, `deposit:currency:${code}`);
        if ((index + 1) % buttonsPerRow === 0) {
          keyboard.row();
        }
      }
    });

    if (currencies.length % buttonsPerRow !== 0) {
      keyboard.row();
    }
  }

  /**
   * Create keyboard with available deposit currencies
   */
  private async createDepositCurrencyKeyboard(ctx: AuthenticatedBotContext): Promise<InlineKeyboard> {
    const keyboard = new InlineKeyboard();
    const availableCurrencies = await this.getDepositCurrencies();
    const defaultCurrencies = [CurrencyCode.Usdt, CurrencyCode.Ton, CurrencyCode.Btc];
    const currencies = availableCurrencies.length === 0 ? defaultCurrencies : availableCurrencies;

    this.addCurrencyButtons(keyboard, currencies);
    keyboard.text(ctx.t('common.back'), 'balance:view');

    return keyboard;
  }

  /**
   * Get currencies available for deposit from provider configuration
   */
  private async getDepositCurrencies(): Promise<CurrencyCode[]> {
    try {
      const em = this.em.fork();
      const providerCurrencies = await em.find(
        ProviderCurrencyEntity,
        { isEnabled: true, supportsDeposits: true },
        { populate: ['currency'] },
      );

      const currencySet = new Set<CurrencyCode>();

      for (const pc of providerCurrencies) {
        // eslint-disable-next-line no-await-in-loop -- MikroORM lazy reference loading must be sequential
        const currency = await pc.currency.load();
        if (currency?.code) {
          currencySet.add(currency.code as CurrencyCode);
        }
      }

      return Array.from(currencySet);
    } catch (error) {
      this.logger.error('Failed to get deposit currencies', { error: toError(error) });

      return [];
    }
  }

  /**
   * Get user balances
   */
  private async getUserBalances(userId: string): Promise<UserBalanceEntity[]> {
    const em = this.em.fork();

    return await em.find(
      UserBalanceEntity,
      { user: userId },
      {
        populate: ['currency'],
      },
    );
  }

  /**
   * Format balance view
   */
  private async formatBalanceView(ctx: AuthenticatedBotContext, balances: UserBalanceEntity[]): Promise<string> {
    if (balances.length === 0) {
      return ctx.t('balance.no_balances_found');
    }

    let text = ctx.t('balance.your_balance') + '\n\n';

    for (const balance of balances) {
      // eslint-disable-next-line no-await-in-loop -- MikroORM lazy reference loading must be sequential
      const currency = await balance.currency.load();
      if (!currency) {
        continue;
      }

      const availableBalanceDisplay = toDisplayString(balance.getAvailableBalance(), 8);
      const lockedBalanceDisplay = toDisplayString(balance.getLockedBalance(), 8);
      const totalBalanceDisplay = toDisplayString(balance.getTotalBalance(), 8);

      const currencySymbol = currency.symbol ?? currency.code;

      text +=
        `<b>${currency.code}:</b>\n` +
        `  ${ctx.t('balance.available')}: ${availableBalanceDisplay} ${currencySymbol}\n` +
        `  ${ctx.t('balance.locked')}: ${lockedBalanceDisplay} ${currencySymbol}\n` +
        `  ${ctx.t('balance.total')}: ${totalBalanceDisplay} ${currencySymbol}\n\n`;
    }

    text += ctx.t('balance.balance_buttons_hint');

    return text;
  }

  /**
   * Format transaction history
   */
  private async formatTransactionHistory(
    ctx: AuthenticatedBotContext,
    transactions: UserBalanceHistoryEntity[],
    page: number,
    totalPages: number,
  ): Promise<string> {
    let text = ctx.t('balance.transaction_history_title', { page, totalPages }) + '\n\n';

    for (const tx of transactions) {
      const currencyCode = tx.currency;
      const amount = decimal(tx.amount);
      const isPositive = amount.greaterThanOrEqualTo(0);
      const amountText = isPositive ? `+${toDisplayString(amount, 8)}` : toDisplayString(amount, 8);
      const emoji = isPositive ? '📈' : '📉';

      text +=
        `${emoji} <b>${tx.type}</b>\n` +
        `  ${ctx.t('balance.amount')}: ${amountText} ${currencyCode}\n` +
        `  ${ctx.t('balance.date')}: ${tx.createdAt.toLocaleString()}\n` +
        (tx.description ? `  ${ctx.t('balance.note')}: ${tx.description}\n` : '') +
        `\n`;
    }

    return text;
  }

  /**
   * Create currency selection keyboard
   */
  private async createCurrencySelectionKeyboard(ctx: AuthenticatedBotContext, balances: UserBalanceEntity[]) {
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

  // ===== Additional Methods (extracted from callback-router) =====

  async handleWithdrawalMenu(ctx: AuthenticatedBotContext): Promise<void> {
    const keyboard = this.menuHandler.createWithdrawalMenuKeyboard(ctx);
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('balance.withdrawal_menu'),
      replyMarkup: keyboard,
    });
  }

  async handleWithdrawalCurrency(ctx: AuthenticatedBotContext, currencyId: string): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'withdrawal_amount';
      ctx.session.formData = { currencyId };
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('balance.enter_withdrawal_amount'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.cancel'), 'menu:balance'),
    });
  }

  async handleWithdrawalAmount(ctx: AuthenticatedBotContext, amount: string): Promise<void> {
    const keyboard = this.menuHandler.createConfirmationKeyboard(ctx, 'withdraw:confirm', { amount });
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('balance.withdrawal_confirm', { amount }),
      replyMarkup: keyboard,
    });
  }

  async handleWithdrawalConfirm(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('balance.withdrawal_processing'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:balance'),
    });
  }

  async handleWithdrawalHistory(ctx: AuthenticatedBotContext): Promise<void> {
    const history = await this.em.find(
      UserBalanceHistoryEntity,
      { user: ctx.user.id, type: TransactionType.Withdrawal },
      { orderBy: { createdAt: 'DESC' }, limit: 10 },
    );

    let text = ctx.t('balance.withdrawal_history_title');
    if (history.length === 0) {
      text += ctx.t('balance.no_withdrawal_history');
    } else {
      for (const tx of history) {
        text += `• ${toDisplayString(tx.amount, 2)} - ${tx.createdAt.toLocaleDateString()}\n`;
      }
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:balance'),
    });
  }

  async handleWithdrawalMethods(ctx: AuthenticatedBotContext): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('balance.withdrawal_methods'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:balance'),
    });
  }

  async handleWithdrawalLimits(ctx: AuthenticatedBotContext): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('balance.withdrawal_limits'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:balance'),
    });
  }

  async handleDepositHistory(ctx: AuthenticatedBotContext): Promise<void> {
    const history = await this.em.find(
      UserBalanceHistoryEntity,
      { user: ctx.user.id, type: TransactionType.Deposit },
      { orderBy: { createdAt: 'DESC' }, limit: 10 },
    );

    let text = ctx.t('balance.deposit_history_title');
    if (history.length === 0) {
      text += ctx.t('balance.no_deposit_history');
    } else {
      for (const tx of history) {
        text += `• ${toDisplayString(tx.amount, 2)} - ${tx.createdAt.toLocaleDateString()}\n`;
      }
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:balance'),
    });
  }

  async handleBalanceAnalytics(ctx: AuthenticatedBotContext): Promise<void> {
    const history = await this.em.find(
      UserBalanceHistoryEntity,
      { user: ctx.user.id },
      { orderBy: { createdAt: 'DESC' }, limit: 100 },
    );

    let totalIncome = decimal(0);
    let totalExpense = decimal(0);

    for (const tx of history) {
      const amount = decimal(tx.amount);
      if (amount.greaterThan(0)) {
        totalIncome = totalIncome.plus(amount);
      } else {
        totalExpense = totalExpense.plus(amount.abs());
      }
    }

    let text = ctx.t('balance.analytics_title');
    text += `\n• ${ctx.t('balance.total_income')}: $${toDisplayString(totalIncome, 2)}`;
    text += `\n• ${ctx.t('balance.total_expense')}: $${toDisplayString(totalExpense, 2)}`;
    text += `\n• ${ctx.t('balance.transactions_count')}: ${history.length}`;

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:balance'),
    });
  }
}
