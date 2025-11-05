/**
 * Balance Action Handler
 *
 * Handles user balance-related actions including viewing balances,
 * transaction history, deposits, and withdrawals.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedBotContext } from '@app/feature-bot-shared';
import { EntityManager } from '@mikro-orm/core';
import { UserBalanceEntity, UserBalanceHistoryEntity } from '@app/database';
import { MenuActionHandler } from './menu-action.handler';
import { decimal, lessThan, toDisplayString } from '@app/common-shared';
import { MessageService } from '../service/message.service';
import { InlineKeyboard } from 'grammy';

@Injectable()
export class BalanceActionHandler {
  private readonly logger = new Logger(BalanceActionHandler.name);

  constructor(
    private readonly em: EntityManager,
    private readonly menuHandler: MenuActionHandler,
    private readonly messageService: MessageService,
  ) {}

  /**
   * Handle balance view action
   */
  async handleBalanceView(ctx: AuthenticatedBotContext): Promise<void> {
    const em = this.em.fork();
    try {
      const balances = await this.getUserBalances(ctx.user.id);
      const balanceText = await this.formatBalanceView(ctx, balances);
      const keyboard = this.menuHandler.createBalanceMenuKeyboard();

      await this.messageService.sendOrEditMessage(ctx, {
        text: balanceText,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      this.logger.log('Balance viewed', { userId: ctx.user.id });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle transaction history view
   */
  async handleTransactionHistory(ctx: AuthenticatedBotContext, page = 1): Promise<void> {
    const em = this.em.fork();
    try {
      const limit = 10;
      const offset = (page - 1) * limit;

      const [transactions, total] = await this.em.findAndCount(
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
        await ctx.reply(ctx.t('balance.no_transactions'));

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
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle withdrawal initiation
   */
  async handleWithdrawalStart(ctx: AuthenticatedBotContext): Promise<void> {
    const em = this.em.fork();
    try {
      // Check if user is verified
      if (!ctx.user.isVerified) {
        await ctx.reply(ctx.t('balance.verification_required'));

        return;
      }

      const balances = await this.getUserBalances(ctx.user.id);
      const availableBalance = balances.length > 0 ? balances[0].getAvailableBalance() : decimal(0);

      if (lessThan(availableBalance, decimal(10))) {
        await ctx.reply(ctx.t('balance.insufficient_funds'));

        return;
      }

      // Store withdrawal state in session
      if (ctx.session) {
        ctx.session.conversationState = 'withdrawal';
        ctx.session.formData = { step: 'select_currency' };
      }

      const currencyKeyboard = await this.createCurrencySelectionKeyboard(ctx, balances);

      await ctx.reply(ctx.t('balance.withdrawal_prompt'), {
        parse_mode: 'HTML',
        reply_markup: currencyKeyboard,
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle deposit initiation
   */
  async handleDepositStart(ctx: AuthenticatedBotContext): Promise<void> {
    try {
      const depositText =
        ctx.t('balance.deposit_info_title') + '\n\n' +
        ctx.t('balance.deposit_info_steps') + '\n\n' +
        ctx.t('balance.deposit_info_min_deposit');

      const { InlineKeyboard } = require('grammy');
      const depositKeyboard = new InlineKeyboard()
        .text(ctx.t('balance.deposit_card'), 'deposit:card')
        .text(ctx.t('balance.deposit_crypto'), 'deposit:crypto')
        .row()
        .text(ctx.t('balance.deposit_bank'), 'deposit:bank')
        .row()
        .text(ctx.t('menu.back_to_balance'), 'menu:balance');

      await ctx.replyWithHTML(depositText, { reply_markup: depositKeyboard });

      this.logger.log('Deposit info viewed', { userId: ctx.user.id });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Get user balances
   */
  private async getUserBalances(userId: string): Promise<UserBalanceEntity[]> {
    return await this.em.find(
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
      const currency = await balance.currency.load();
      if (!currency) {
        continue;
      }

      const availableBalanceDisplay = toDisplayString(balance.getAvailableBalance(), 8);
      const lockedBalanceDisplay = toDisplayString(balance.getLockedBalance(), 8);
      const totalBalanceDisplay = toDisplayString(balance.getTotalBalance(), 8);

      text +=
        `<b>${currency.code}:</b>\n` +
        `  ${ctx.t('balance.available')}: ${availableBalanceDisplay} ${currency.symbol ?? currency.code}\n` +
        `  ${ctx.t('balance.locked')}: ${lockedBalanceDisplay} ${currency.symbol ?? currency.code}\n` +
        `  ${ctx.t('balance.total')}: ${totalBalanceDisplay} ${currency.symbol ?? currency.code}\n\n`;
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
      // tx.currency is a CurrencyCode enum, not a reference
      const currencyCode = tx.currency;
      const amount = decimal(tx.amount);
      const isPositive = amount.greaterThanOrEqualTo(0);
      const amountText = isPositive ? `+${toDisplayString(amount, 8)}` : toDisplayString(amount, 8);
      const emoji = isPositive ? '📈' : '📉';

      text +=
        `${emoji} <b>${tx.type}</b>\n` +
        `  ${ctx.t('balance.amount')}: ${amountText} ${currencyCode}\n` +
        `  ${ctx.t('balance.date')}: ${tx.createdAt.toLocaleString()}\n` +
        `${tx.description ? `  ${ctx.t('balance.note')}: ${tx.description}\n` : ''}` +
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
}
