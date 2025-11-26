/**
 * Balance Handler
 *
 * Grammy Composer for balance-related callback queries.
 * Handles balance viewing, deposits, withdrawals, and transaction history.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Composer } from 'grammy';
import { EntityManager } from '@mikro-orm/core';
import { AuthenticatedBotContext, BotContext, isAuthenticated } from '@app/feature-bot-shared';
import { UserBalanceEntity, UserBalanceHistoryEntity, ProviderCurrencyEntity, CurrencyCode } from '@app/database';
import { decimal, lessThan, toDisplayString, toError } from '@app/common-shared';
import { PaymentService } from '@app/feature-payment-main';
import { MessageService } from '../../service/message.service';
import {
  createBalanceMenuKeyboard,
  createDepositCurrencyKeyboard,
  createHistoryPaginationKeyboard,
  createDepositConfirmKeyboard,
  createBackToBalanceKeyboard,
  createBackToDepositKeyboard,
  createWithdrawCurrencyKeyboard,
  CurrencyDisplayData,
} from './balance.keyboards';

@Injectable()
export class BalanceHandler {
  private readonly logger = new Logger(BalanceHandler.name);
  private composer: Composer<BotContext>;

  constructor(
    private readonly em: EntityManager,
    private readonly messageService: MessageService,
    private readonly paymentService: PaymentService,
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
    // Balance view
    this.composer.callbackQuery('balance:view', (ctx) =>
      this.withAuth(ctx, (authCtx) => this.handleBalanceView(authCtx)),
    );

    this.composer.callbackQuery('menu:balance', (ctx) =>
      this.withAuth(ctx, (authCtx) => this.handleBalanceView(authCtx)),
    );

    // Transaction history with pagination
    this.composer.callbackQuery(/^balance:history(?::(\d+))?$/, (ctx) => {
      const match = ctx.callbackQuery.data.match(/^balance:history(?::(\d+))?$/);
      const page = match?.[1] ? parseInt(match[1], 10) : 1;

      return this.withAuth(ctx, (authCtx) => this.handleTransactionHistory(authCtx, page));
    });

    // Deposit flow
    this.composer.callbackQuery('balance:deposit', (ctx) =>
      this.withAuth(ctx, (authCtx) => this.handleDepositStart(authCtx)),
    );

    this.composer.callbackQuery(/^deposit:currency:(.+)$/, (ctx) => {
      const match = ctx.callbackQuery.data.match(/^deposit:currency:(.+)$/);
      const currency = match?.[1] as CurrencyCode;

      return this.withAuth(ctx, (authCtx) => this.handleDepositCurrency(authCtx, currency));
    });

    // Withdrawal flow
    this.composer.callbackQuery('balance:withdraw', (ctx) =>
      this.withAuth(ctx, (authCtx) => this.handleWithdrawalStart(authCtx)),
    );

    // Text message handler for deposit amount input
    this.composer.on('message:text', (ctx) => this.handleTextMessage(ctx));
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
   * Handle balance view action
   */
  async handleBalanceView(ctx: AuthenticatedBotContext): Promise<void> {
    try {
      const balances = await this.getUserBalances(ctx.user.id);
      const balanceText = await this.formatBalanceView(ctx, balances);
      const keyboard = createBalanceMenuKeyboard(ctx);

      await this.messageService.sendOrEditMessage(ctx, {
        text: balanceText,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      this.logger.log('Balance viewed', { userId: ctx.user.id });
    } catch (error) {
      await this.handleError(ctx, toError(error));
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
        const backKeyboard = createBackToBalanceKeyboard(ctx);
        await this.messageService.sendOrEditMessage(ctx, {
          text: ctx.t('balance.no_transactions'),
          replyMarkup: backKeyboard,
        });

        return;
      }

      const totalPages = Math.ceil(total / limit);
      const historyText = this.formatTransactionHistory(ctx, transactions, page, totalPages);
      const keyboard = createHistoryPaginationKeyboard(ctx, page, totalPages);

      await this.messageService.sendOrEditMessage(ctx, {
        text: historyText,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      this.logger.log('Transaction history viewed', { userId: ctx.user.id, page, total });
    } catch (error) {
      await this.handleError(ctx, toError(error));
    }
  }

  /**
   * Handle deposit initiation - shows available currencies from database
   */
  async handleDepositStart(ctx: AuthenticatedBotContext): Promise<void> {
    try {
      const currencies = await this.getDepositCurrencies();

      if (currencies.length === 0) {
        await this.messageService.sendOrEditMessage(ctx, {
          text: ctx.t('balance.no_deposit_currencies'),
          parseMode: 'HTML',
          replyMarkup: createBackToBalanceKeyboard(ctx),
        });

        return;
      }

      const keyboard = createDepositCurrencyKeyboard(ctx, currencies);
      const depositText = ctx.t('balance.deposit_info_title') + '\n\n' + ctx.t('balance.deposit_select_currency');

      await this.messageService.sendOrEditMessage(ctx, {
        text: depositText,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      this.logger.log('Deposit currency selection viewed', { userId: ctx.user.id });
    } catch (error) {
      await this.handleError(ctx, toError(error));
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

      const keyboard = createBackToDepositKeyboard(ctx);

      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('balance.deposit_enter_amount', { currency, min: '1' }),
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      this.logger.log('Deposit amount input prompted', { userId: ctx.user.id, currency });
    } catch (error) {
      await this.handleError(ctx, toError(error));
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

      const currencyKeyboard = await createWithdrawCurrencyKeyboard(ctx, balances);

      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('balance.withdrawal_prompt'),
        parseMode: 'HTML',
        replyMarkup: currencyKeyboard,
      });
    } catch (error) {
      await this.handleError(ctx, toError(error));
    }
  }

  /**
   * Handle text messages (deposit amount input)
   */
  private async handleTextMessage(ctx: BotContext): Promise<void> {
    if (!isAuthenticated(ctx)) {
      return;
    }

    const state = ctx.session?.conversationState;
    if (state !== 'deposit_amount') {
      return;
    }

    const text = ctx.message?.text || '';
    await this.handleDepositAmount(ctx, text);
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

      const keyboard = createDepositConfirmKeyboard(ctx, invoice.payUrl, amount, currency);

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
   * Get user balances
   */
  private async getUserBalances(userId: string): Promise<UserBalanceEntity[]> {
    const em = this.em.fork();

    return await em.find(UserBalanceEntity, { user: userId }, { populate: ['currency'] });
  }

  /**
   * Get currencies available for deposit from database
   */
  private async getDepositCurrencies(): Promise<CurrencyDisplayData[]> {
    try {
      const em = this.em.fork();
      const providerCurrencies = await em.find(
        ProviderCurrencyEntity,
        { isEnabled: true, supportsDeposits: true },
        { populate: ['currency'] },
      );

      const currencyMap = new Map<string, CurrencyDisplayData>();

      for (const pc of providerCurrencies) {
        // eslint-disable-next-line no-await-in-loop -- MikroORM lazy reference loading must be sequential
        const currency = await pc.currency.load();
        if (currency?.code && !currencyMap.has(currency.code)) {
          currencyMap.set(currency.code, {
            code: currency.code,
            symbol: currency.symbol ?? currency.code,
            name: currency.name ?? currency.code,
          });
        }
      }

      return Array.from(currencyMap.values());
    } catch (error) {
      this.logger.error('Failed to get deposit currencies', { error: toError(error) });

      return [];
    }
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
  private formatTransactionHistory(
    ctx: AuthenticatedBotContext,
    transactions: UserBalanceHistoryEntity[],
    page: number,
    totalPages: number,
  ): string {
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
   * Handle errors
   */
  private async handleError(ctx: BotContext, error: Error): Promise<void> {
    this.logger.error('Balance handler error', { error: error.message, stack: error.stack });
    await ctx.reply(ctx.t('common.errors.operation_failed'));
  }
}
