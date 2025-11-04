/**
 * Balance Action Handler
 *
 * Handles user balance-related actions including viewing balances,
 * transaction history, deposits, and withdrawals.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import { EntityManager } from '@mikro-orm/core';
import { UserEntity, UserBalanceEntity, UserBalanceHistoryEntity, CurrencyEntity } from '@app/database';
import { MenuActionHandler } from './menu-action.handler';

@Injectable()
export class BalanceActionHandler {
  private readonly logger = new Logger(BalanceActionHandler.name);

  constructor(
    private readonly em: EntityManager,
    private readonly menuHandler: MenuActionHandler,
  ) {}

  /**
   * Handle balance view action
   */
  async handleBalanceView(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply('Please authenticate first using /start');

        return;
      }

      const user = await this.findUserByTelegramId(ctx.from.id.toString());

      if (!user) {
        await ctx.reply('User not found. Please use /start to register.');

        return;
      }

      const balances = await this.getUserBalances(user.id);
      const balanceText = await this.formatBalanceView(balances);
      const keyboard = this.menuHandler.createBalanceMenuKeyboard();

      await ctx.replyWithHTML(balanceText, { reply_markup: keyboard });

      this.logger.log('Balance viewed', { userId: user.id });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle transaction history view
   */
  async handleTransactionHistory(ctx: BotContext, page = 1): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply('Please authenticate first using /start');

        return;
      }

      const user = await this.findUserByTelegramId(ctx.from.id.toString());

      if (!user) {
        await ctx.reply('User not found. Please use /start to register.');

        return;
      }

      const limit = 10;
      const offset = (page - 1) * limit;

      const [transactions, total] = await this.em.findAndCount(
        UserBalanceHistoryEntity,
        { user: user.id },
        {
          orderBy: { createdAt: 'DESC' },
          limit,
          offset,
          populate: ['currency'],
        },
      );

      if (transactions.length === 0) {
        await ctx.reply('No transaction history found.');

        return;
      }

      const totalPages = Math.ceil(total / limit);
      const historyText = await this.formatTransactionHistory(transactions, page, totalPages);

      let keyboard = this.menuHandler.createPaginationKeyboard(page, totalPages, 'balance:history');

      if (totalPages > 1) {
        keyboard = keyboard.row();
      }

      keyboard = keyboard.text('« Back', 'menu:balance');

      await ctx.replyWithHTML(historyText, { reply_markup: keyboard });

      this.logger.log('Transaction history viewed', { userId: user.id, page });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle withdrawal initiation
   */
  async handleWithdrawalStart(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply('Please authenticate first using /start');

        return;
      }

      const user = await this.findUserByTelegramId(ctx.from.id.toString());

      if (!user) {
        await ctx.reply('User not found. Please use /start to register.');

        return;
      }

      // Check if user is verified
      if (!user.isVerified) {
        await ctx.reply('❌ You must verify your account before making withdrawals. Use the Profile menu to verify.');

        return;
      }

      const balances = await this.getUserBalances(user.id);

      if (balances.length === 0) {
        await ctx.reply('❌ You have no balance available for withdrawal.');

        return;
      }

      // Store withdrawal state in session
      if (ctx.session) {
        ctx.session.conversationState = 'withdrawal';
        ctx.session.formData = { step: 'select_currency' };
      }

      const currencyKeyboard = await this.createCurrencySelectionKeyboard(balances);

      await ctx.reply('💸 <b>Withdrawal</b>\n\nPlease select the currency you want to withdraw:', {
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
  async handleDepositStart(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply('Please authenticate first using /start');

        return;
      }

      const depositText =
        '💰 <b>Deposit Funds</b>\n\n' +
        'To deposit funds to your account, please follow these steps:\n\n' +
        '1. Select your preferred payment method\n' +
        '2. Choose the currency and amount\n' +
        '3. Complete the payment using the provided details\n' +
        '4. Funds will be credited within 10-30 minutes\n\n' +
        '<i>Minimum deposit: $10 USD equivalent</i>';

      const { InlineKeyboard } = require('grammy');
      const depositKeyboard = new InlineKeyboard()
        .text('💳 Credit Card', 'deposit:card')
        .text('🪙 Crypto', 'deposit:crypto')
        .row()
        .text('🏦 Bank Transfer', 'deposit:bank')
        .row()
        .text('« Back', 'menu:balance');

      await ctx.replyWithHTML(depositText, { reply_markup: depositKeyboard });

      this.logger.log('Deposit info viewed', { userId: ctx.from.id });
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
   * Find user by Telegram ID
   */
  private async findUserByTelegramId(telegramId: string): Promise<UserEntity | null> {
    return await this.em.findOne(UserEntity, { telegramId });
  }

  /**
   * Format balance view
   */
  private async formatBalanceView(balances: UserBalanceEntity[]): Promise<string> {
    if (balances.length === 0) {
      return '<b>💰 Your Balance</b>\n\n' + '<i>No balances found. Start earning by completing traffic orders!</i>';
    }

    let text = '<b>💰 Your Balance</b>\n\n';

    for (const balance of balances) {
      const currency = await balance.currency.load();
      if (!currency) continue;

      const availableBalance = parseFloat(balance.getAvailableBalance());
      const lockedBalance = parseFloat(balance.getLockedBalance());
      const totalBalance = parseFloat(balance.getTotalBalance());

      text +=
        `<b>${currency.code}:</b>\n` +
        `  Available: ${availableBalance.toFixed(8)} ${currency.symbol ?? currency.code}\n` +
        `  Locked: ${lockedBalance.toFixed(8)} ${currency.symbol ?? currency.code}\n` +
        `  Total: ${totalBalance.toFixed(8)} ${currency.symbol ?? currency.code}\n\n`;
    }

    text += '<i>Use the buttons below to manage your balance.</i>';

    return text;
  }

  /**
   * Format transaction history
   */
  private async formatTransactionHistory(
    transactions: UserBalanceHistoryEntity[],
    page: number,
    totalPages: number,
  ): Promise<string> {
    let text = `<b>📜 Transaction History</b> (Page ${page}/${totalPages})\n\n`;

    for (const tx of transactions) {
      // tx.currency is a CurrencyCode enum, not a reference
      const currencyCode = tx.currency;
      const amount = parseFloat(tx.amount);
      const amountText = amount >= 0 ? `+${amount}` : amount.toString();
      const emoji = amount >= 0 ? '📈' : '📉';

      text +=
        `${emoji} <b>${tx.type}</b>\n` +
        `Amount: ${amountText} ${currencyCode}\n` +
        `Date: ${tx.createdAt.toLocaleString()}\n` +
        `${tx.description ? `Note: ${tx.description}\n` : ''}` +
        `\n`;
    }

    return text;
  }

  /**
   * Create currency selection keyboard
   */
  private async createCurrencySelectionKeyboard(balances: UserBalanceEntity[]) {
    const { InlineKeyboard } = require('grammy');
    const keyboard = new InlineKeyboard();

    for (const balance of balances) {
      const currency = await balance.currency.load();
      if (!currency) continue;

      const availableBalance = parseFloat(balance.getAvailableBalance());

      if (availableBalance > 0) {
        keyboard.text(`${currency.symbol ?? currency.code} ${currency.code}`, `withdraw:currency:${currency.id}`).row();
      }
    }

    keyboard.text('« Cancel', 'menu:balance');

    return keyboard;
  }
}
