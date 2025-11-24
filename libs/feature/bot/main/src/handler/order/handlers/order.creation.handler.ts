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
import { BotOrderService } from '../bot-order.service';
import { OrderFlowStep } from '@app/feature-order-shared';
import { createAddBotAdminKeyboard, createChannelLinkHelpKeyboard, createModerationKeyboard } from '../order.keyboards';

@Injectable()
export class OrderCreationHandler {
  private readonly logger = new Logger(OrderCreationHandler.name);
  private composer: Composer<BotContext>;

  constructor(private readonly orderService: BotOrderService) {
    this.composer = new Composer<BotContext>();
    this.setupHandlers();
  }

  getComposer(): Composer<BotContext> {
    return this.composer;
  }

  private setupHandlers(): void {
    // Order creation flow
    this.composer.callbackQuery('order:create:start', (ctx) => this.handleStartOrderCreation(ctx));
    this.composer.callbackQuery('order:create:back', (ctx) => this.handleBack(ctx));

    // Bot admin check
    this.composer.callbackQuery('order:bot:check', (ctx) => this.handleBotAdminCheck(ctx));
    this.composer.callbackQuery('order:bot:skip', (ctx) => this.handleBotAdminSkip(ctx));

    // Configuration skip
    this.composer.callbackQuery(/^order:config:skip:(.+)$/, (ctx) => this.handleConfigSkip(ctx));

    // Text message handler for channel link input
    this.composer.on('message:text', (ctx) => this.handleTextMessage(ctx));
  }

  /**
   * Handle start order creation (A2: Enter channel link)
   */
  private async handleStartOrderCreation(ctx: BotContext): Promise<void> {
    try {
      // Initialize order creation state
      this.orderService.initOrderCreation(ctx);

      const message = `${ctx.t('bot.order.creation')}\n${ctx.t('bot.order.step', { current: 1, total: 3 })}\n\n${ctx.t('bot.order.channel_link_instruction')}\n\n${ctx.t('bot.order.examples_title')}\n${ctx.t('bot.order.example1')}\n${ctx.t('bot.order.example2')}`;
      const keyboard = createChannelLinkHelpKeyboard();

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery(ctx.t('bot.order.channel_link_instruction'));
    } catch (error) {
      this.logger.error('Error starting order creation', error);
      await ctx.answerCallbackQuery(ctx.t('common.errors.save_failed'));
    }
  }

  /**
   * Handle back navigation
   */
  private async handleBack(ctx: BotContext): Promise<void> {
    try {
      // Clear session and go back to order list
      this.orderService.clearOrderSessionState(ctx);
      await ctx.answerCallbackQuery(ctx.t('common.buttons.back'));
    } catch (error) {
      this.logger.error('Error handling back', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
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
      await ctx.reply(ctx.t('common.error'));
    }
  }

  /**
   * Handle channel link input
   */
  private async handleChannelLinkInput(ctx: BotContext, link: string): Promise<void> {
    // Validate link format
    const validation = await this.orderService.validateChannelLink(link);
    if (!validation.valid) {
      await ctx.reply(ctx.t('bot.order.invalid_link'));

      return;
    }

    // Get channel info
    const channel = await this.orderService.getChannelInfo(link);
    if (!channel) {
      await ctx.reply(ctx.t('bot.order.channel_not_found'));

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

    const message = `${ctx.t('bot.order.channel_found')}\n\n${ctx.t('bot.order.channel_name')} ${channel.title}\n${ctx.t('bot.order.channel_subscribers')} ${channel.subscriberCount || 0}\n\n${ctx.t('bot.order.bot_admin_instruction')}\n@${ctx.me.username}\n\n${ctx.t('bot.order.requirement')}`;
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
        await ctx.answerCallbackQuery(ctx.t('common.errors.channel_not_found'));

        return;
      }

      // Check if bot is admin
      const isAdmin = await this.orderService.checkBotIsAdmin(state.channel.id);

      if (!isAdmin) {
        await ctx.answerCallbackQuery({
          text: ctx.t('bot.order.bot_not_admin'),
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

      await ctx.answerCallbackQuery(ctx.t('bot.order.bot_added'));
    } catch (error) {
      this.logger.error('Error checking bot admin', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle bot admin skip
   */
  private async handleBotAdminSkip(ctx: BotContext): Promise<void> {
    try {
      const state = this.orderService.getOrderSessionState(ctx);
      if (!state) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      state.botAdminCheckStatus = 'skipped';
      this.orderService.saveOrderSessionState(ctx, state);

      // Create order and move to moderation (A4)
      await this.createOrderAndShowModeration(ctx);

      await ctx.answerCallbackQuery(ctx.t('common.buttons.next'));
    } catch (error) {
      this.logger.error('Error skipping bot admin', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
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

    const botIsAdmin = state.channel?.botIsAdmin || false;
    const message = `${ctx.t('bot.order.moderation_submitted')}\n\n${ctx.t('bot.order.channel')} ${state.channel?.title}\n${ctx.t('bot.order.link')} ${state.config.channelLink}\n${ctx.t('bot.order.status_label')} ${ctx.t('bot.order.status_pending')}\n\n${botIsAdmin ? ctx.t('bot.order.bot_added') : ctx.t('bot.order.bot_not_added')}\n\n${ctx.t('bot.order.time_estimate')}`;
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
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.access_denied'));

        return;
      }

      // Clear session state
      this.orderService.clearOrderSessionState(ctx);

      await ctx.answerCallbackQuery(ctx.t('common.success.created'));
    } catch (error) {
      this.logger.error('Error skipping config', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }
}
