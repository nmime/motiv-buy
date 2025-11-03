/**
 * Order Creation Handler
 *
 * Handles order creation flow (Steps A2-A4):
 * - A2: Channel link input
 * - A3: Add bot as administrator
 * - A4: Moderation status
 */

import { Injectable, Logger } from '@nestjs/common';
import { Composer } from 'grammy';
import { BotContext } from '@app/feature-bot-shared';
import { OrderService } from '../order.service';
import { OrderFlowStep } from '../order.types';
import {
  createChannelLinkHelpKeyboard,
  createAddBotAdminKeyboard,
  createModerationKeyboard,
} from '../order.keyboards';
import {
  getChannelLinkInputMessage,
  getAddBotAdminMessage,
  getModerationMessage,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '../order.messages';

@Injectable()
export class OrderCreationHandler {
  private readonly logger = new Logger(OrderCreationHandler.name);
  private composer: Composer<BotContext>;
  private readonly BOT_USERNAME = 'subgram_checksub_1_bot';

  constructor(private readonly orderService: OrderService) {
    this.composer = new Composer<BotContext>();
    this.setupHandlers();
  }

  getComposer(): Composer<BotContext> {
    return this.composer;
  }

  private setupHandlers(): void {
    // Order creation flow
    this.composer.callbackQuery('order:create:start', ctx => this.handleStartOrderCreation(ctx));
    this.composer.callbackQuery('order:create:back', ctx => this.handleBack(ctx));

    // Bot admin check
    this.composer.callbackQuery('order:bot:check', ctx => this.handleBotAdminCheck(ctx));
    this.composer.callbackQuery('order:bot:skip', ctx => this.handleBotAdminSkip(ctx));

    // Configuration skip
    this.composer.callbackQuery(/^order:config:skip:(.+)$/, ctx => this.handleConfigSkip(ctx));

    // Text message handler for channel link input
    this.composer.on('message:text', ctx => this.handleTextMessage(ctx));
  }

  /**
   * Handle start order creation (A2: Enter channel link)
   */
  private async handleStartOrderCreation(ctx: BotContext): Promise<void> {
    try {
      // Initialize order creation state
      this.orderService.initOrderCreation(ctx);

      const message = getChannelLinkInputMessage();
      const keyboard = createChannelLinkHelpKeyboard();

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery('📝 Введите ссылку на канал');
    } catch (error) {
      this.logger.error('Error starting order creation', error);
      await ctx.answerCallbackQuery('❌ Ошибка создания заказа');
    }
  }

  /**
   * Handle back navigation
   */
  private async handleBack(ctx: BotContext): Promise<void> {
    try {
      // Clear session and go back to order list
      this.orderService.clearOrderSessionState(ctx);
      await ctx.answerCallbackQuery('◀️ Возврат к списку');
    } catch (error) {
      this.logger.error('Error handling back', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
  }

  /**
   * Handle text messages (used for channel link input)
   */
  private async handleTextMessage(ctx: BotContext): Promise<void> {
    const state = this.orderService.getOrderSessionState(ctx);
    if (!state) {
      return; // Not in order creation flow
    }

    const text = ctx.message?.text || '';

    try {
      if (state.currentStep === OrderFlowStep.EnterChannelLink) {
        await this.handleChannelLinkInput(ctx, text);
      }
    } catch (error) {
      this.logger.error('Error handling text message', error);
      await ctx.reply('❌ Произошла ошибка. Попробуйте еще раз.');
    }
  }

  /**
   * Handle channel link input
   */
  private async handleChannelLinkInput(ctx: BotContext, link: string): Promise<void> {
    // Validate link format
    const validation = await this.orderService.validateChannelLink(link);
    if (!validation.valid) {
      await ctx.reply(ERROR_MESSAGES.invalidLink);
      return;
    }

    // Get channel info
    const channel = await this.orderService.getChannelInfo(link);
    if (!channel) {
      await ctx.reply(ERROR_MESSAGES.channelNotFound);
      return;
    }

    // Save channel info to session
    const state = this.orderService.getOrderSessionState(ctx);
    if (state) {
      state.channel = channel;
      state.config.channelLink = link;
      this.orderService.saveOrderSessionState(ctx, state);
    }

    // Move to next step (A3: Add bot as admin)
    this.orderService.moveToNextStep(ctx, OrderFlowStep.AddBotAdmin);

    const message = getAddBotAdminMessage(channel, this.BOT_USERNAME);
    const keyboard = createAddBotAdminKeyboard(channel.username);

    await ctx.reply(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  }

  /**
   * Handle bot admin check
   */
  private async handleBotAdminCheck(ctx: BotContext): Promise<void> {
    try {
      const state = this.orderService.getOrderSessionState(ctx);
      if (!state || !state.channel) {
        await ctx.answerCallbackQuery('❌ Ошибка: канал не найден');
        return;
      }

      // Check if bot is admin
      const isAdmin = await this.orderService.checkBotIsAdmin(state.channel.id);

      if (!isAdmin) {
        await ctx.answerCallbackQuery({
          text: ERROR_MESSAGES.botNotAdmin,
          show_alert: true,
        });
        return;
      }

      // Update channel status
      state.channel.botIsAdmin = true;
      state.botAdminCheckStatus = 'confirmed';
      this.orderService.saveOrderSessionState(ctx, state);

      // Create order and move to moderation (A4)
      await this.createOrderAndShowModeration(ctx);

      await ctx.answerCallbackQuery(SUCCESS_MESSAGES.botAdded);
    } catch (error) {
      this.logger.error('Error checking bot admin', error);
      await ctx.answerCallbackQuery('❌ Ошибка проверки бота');
    }
  }

  /**
   * Handle bot admin skip
   */
  private async handleBotAdminSkip(ctx: BotContext): Promise<void> {
    try {
      const state = this.orderService.getOrderSessionState(ctx);
      if (!state) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      state.botAdminCheckStatus = 'skipped';
      this.orderService.saveOrderSessionState(ctx, state);

      // Create order and move to moderation (A4)
      await this.createOrderAndShowModeration(ctx);

      await ctx.answerCallbackQuery('⚠️ Без бота статистика отписок недоступна');
    } catch (error) {
      this.logger.error('Error skipping bot admin', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
  }

  /**
   * Create order and show moderation screen (A4)
   */
  private async createOrderAndShowModeration(ctx: BotContext): Promise<void> {
    const state = this.orderService.getOrderSessionState(ctx);
    if (!state || !state.channel) {
      return;
    }

    const userId = ctx.from?.id.toString();
    if (!userId) {
      return;
    }

    // Create order
    const order = await this.orderService.createOrder(userId, state.config, state.channel);

    // Move to moderation step
    this.orderService.moveToNextStep(ctx, OrderFlowStep.Moderation);

    const message = getModerationMessage(state.channel, state.channel.botIsAdmin);
    const keyboard = createModerationKeyboard(order.id);

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  }

  /**
   * Handle config skip (use defaults)
   */
  private async handleConfigSkip(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:config:skip:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery('❌ Доступ запрещен');
        return;
      }

      // Clear session state
      this.orderService.clearOrderSessionState(ctx);

      await ctx.answerCallbackQuery('✅ Использованы настройки по умолчанию');
    } catch (error) {
      this.logger.error('Error skipping config', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
  }
}
