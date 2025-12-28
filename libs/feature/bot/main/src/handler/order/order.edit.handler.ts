/**
 * Order Edit Handler
 *
 * Handles order editing operations:
 * - Edit name
 * - Edit daily/total users
 * - Edit price
 * - Edit start time
 * - Edit schedule
 */

import { Injectable, Logger } from '@nestjs/common';
import { Composer, InlineKeyboard } from 'grammy';
import { BotContext, AuthenticatedBotContext, isAuthenticated } from '@app/feature-bot-shared';
import { decimal, greaterThan, lessThan, toNumber } from '@app/common-shared';
import { BotOrderService } from './bot-order.service';
import { createConfigurationKeyboard } from './order.keyboards';
import { MessageService } from '../../service/message.service';
import { PaymentConfigService } from '@app/feature-payment-shared';

/** Edit field types supported by this handler */
type OrderEditField = 'name' | 'link' | 'daily' | 'total' | 'price' | 'startTime' | 'schedule';

/** Session form data for order editing */
interface OrderEditFormData {
  orderId: string;
  field: OrderEditField;
  step: string;
}

@Injectable()
export class OrderEditHandler {
  private readonly logger = new Logger(OrderEditHandler.name);
  private composer: Composer<BotContext>;

  constructor(
    private readonly orderService: BotOrderService,
    private readonly messageService: MessageService,
    private readonly paymentConfigService: PaymentConfigService,
  ) {
    this.composer = new Composer<BotContext>();
    this.setupHandlers();
  }

  private get currencySymbol(): string {
    return this.paymentConfigService.getBaseCurrencySymbol();
  }

  getComposer(): Composer<BotContext> {
    return this.composer;
  }

  private setupHandlers(): void {
    // Edit operations - prompt for input
    this.composer.callbackQuery(/^order:edit:name:(.+)$/, (ctx) => this.handleEditName(ctx));
    this.composer.callbackQuery(/^order:edit:link:(.+)$/, (ctx) => this.handleEditLink(ctx));
    this.composer.callbackQuery(/^order:edit:daily:(.+)$/, (ctx) => this.handleEditDaily(ctx));
    this.composer.callbackQuery(/^order:edit:total:(.+)$/, (ctx) => this.handleEditTotal(ctx));
    this.composer.callbackQuery(/^order:edit:price:(.+)$/, (ctx) => this.handleEditPrice(ctx));
    this.composer.callbackQuery(/^order:edit:start_time:(.+)$/, (ctx) => this.handleEditStartTime(ctx));
    this.composer.callbackQuery(/^order:edit:schedule:(.+)$/, (ctx) => this.handleEditSchedule(ctx));

    // Schedule day toggle callbacks
    this.composer.callbackQuery(/^order:schedule:day:(\d):(.+)$/, (ctx) => this.handleScheduleDayToggle(ctx));
    this.composer.callbackQuery(/^order:schedule:save:(.+)$/, (ctx) => this.handleScheduleSave(ctx));

    // Text message handler for edit input
    this.composer.on('message:text', (ctx) => this.handleTextMessage(ctx));
  }

  /**
   * Create back button keyboard for edit prompts
   */
  private createBackKeyboard(ctx: BotContext, orderId: string): InlineKeyboard {
    return new InlineKeyboard().text(ctx.t('common.back'), `order:config:start:${orderId}`);
  }

  /**
   * Set up session for edit mode
   */
  private setEditSession(ctx: BotContext, orderId: string, field: OrderEditField): void {
    if (ctx.session) {
      ctx.session.conversationState = 'order_edit';
      ctx.session.formData = {
        orderId,
        field,
        step: 'awaiting_input',
      } as Record<string, unknown>;
    }
  }

  /**
   * Clear edit session
   */
  private clearEditSession(ctx: BotContext): void {
    if (ctx.session) {
      ctx.session.conversationState = undefined;
      ctx.session.formData = undefined;
    }
  }

  /**
   * Get edit form data from session
   */
  private getEditFormData(ctx: BotContext): OrderEditFormData | null {
    if (ctx.session?.conversationState !== 'order_edit') {
      return null;
    }

    const { formData } = ctx.session;
    if (!formData || typeof formData !== 'object') {
      return null;
    }

    const data = formData as Record<string, unknown>;
    if (typeof data.orderId === 'string' && typeof data.field === 'string' && typeof data.step === 'string') {
      return data as unknown as OrderEditFormData;
    }

    return null;
  }

  /**
   * Handle edit name - prompts for new name input
   */
  private async handleEditName(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:edit:name:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      // Set session for input handling
      this.setEditSession(ctx, orderId, 'name');

      const currentName = order.config.name || ctx.t('orders.list.no_name');
      const message =
        `<b>${ctx.t('orders.edit.name_title')}</b>\n\n` +
        `${ctx.t('orders.edit.current_value')}: <code>${currentName}</code>\n\n` +
        ctx.t('orders.edit.name_prompt');

      await this.messageService.sendOrEditMessage(ctx, {
        text: message,
        parseMode: 'HTML',
        replyMarkup: this.createBackKeyboard(ctx, orderId),
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error handling edit name', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle edit link - prompts for new channel link
   */
  private async handleEditLink(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:edit:link:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      // Set session for input handling
      this.setEditSession(ctx, orderId, 'link');

      const currentLink = order.config.channelLink || '-';
      const message =
        `<b>${ctx.t('orders.edit.link_title')}</b>\n\n` +
        `${ctx.t('orders.edit.current_value')}: <code>${currentLink}</code>\n\n` +
        `${ctx.t('orders.edit.link_prompt')}\n\n` +
        `${ctx.t('bot.order.examples_title')}\n` +
        `${ctx.t('bot.order.example1')}\n` +
        ctx.t('bot.order.example2');

      await this.messageService.sendOrEditMessage(ctx, {
        text: message,
        parseMode: 'HTML',
        replyMarkup: this.createBackKeyboard(ctx, orderId),
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error handling edit link', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle edit daily users - prompts for new daily limit
   */
  private async handleEditDaily(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:edit:daily:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      // Set session for input handling
      this.setEditSession(ctx, orderId, 'daily');

      const currentDaily = order.config.usersPerDay || 0;
      const message =
        `<b>${ctx.t('orders.edit.daily_title')}</b>\n\n` +
        `${ctx.t('orders.edit.current_value')}: <code>${currentDaily}</code>\n\n` +
        `${ctx.t('orders.edit.daily_prompt')}\n\n` +
        `<i>${ctx.t('orders.edit.numeric_hint')}</i>`;

      await this.messageService.sendOrEditMessage(ctx, {
        text: message,
        parseMode: 'HTML',
        replyMarkup: this.createBackKeyboard(ctx, orderId),
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error handling edit daily', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle edit total users - prompts for new total limit
   */
  private async handleEditTotal(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:edit:total:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      // Set session for input handling
      this.setEditSession(ctx, orderId, 'total');

      const currentTotal = order.config.totalUsers || 0;
      const message =
        `<b>${ctx.t('orders.edit.total_title')}</b>\n\n` +
        `${ctx.t('orders.edit.current_value')}: <code>${currentTotal}</code>\n\n` +
        `${ctx.t('orders.edit.total_prompt')}\n\n` +
        `<i>${ctx.t('orders.edit.numeric_hint')}</i>`;

      await this.messageService.sendOrEditMessage(ctx, {
        text: message,
        parseMode: 'HTML',
        replyMarkup: this.createBackKeyboard(ctx, orderId),
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error handling edit total', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle edit price - prompts for new price per subscriber
   */
  private async handleEditPrice(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:edit:price:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      // Set session for input handling
      this.setEditSession(ctx, orderId, 'price');

      const currentPrice = order.config.pricePerSubscriber || '0.00';
      const message =
        `<b>${ctx.t('orders.edit.price_title')}</b>\n\n` +
        `${ctx.t('orders.edit.current_value')}: <code>${this.currencySymbol}${currentPrice}</code>\n\n` +
        `${ctx.t('orders.edit.price_prompt')}\n\n` +
        `<i>${ctx.t('orders.edit.price_hint')}</i>`;

      await this.messageService.sendOrEditMessage(ctx, {
        text: message,
        parseMode: 'HTML',
        replyMarkup: this.createBackKeyboard(ctx, orderId),
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error handling edit price', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle edit start time - prompts for date/time input
   */
  private async handleEditStartTime(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:edit:start_time:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      // Set session for input handling
      this.setEditSession(ctx, orderId, 'startTime');

      const currentStartTime = order.config.startTime
        ? this.messageService.formatDateTime(ctx, new Date(order.config.startTime))
        : ctx.t('orders.edit.immediate');

      const message =
        `<b>${ctx.t('orders.edit.start_time_title')}</b>\n\n` +
        `${ctx.t('orders.edit.current_value')}: <code>${currentStartTime}</code>\n\n` +
        `${ctx.t('orders.edit.start_time_prompt')}\n\n` +
        `${ctx.t('orders.edit.start_time_formats')}\n` +
        `• <code>now</code> - ${ctx.t('orders.edit.start_now')}\n` +
        `• <code>2024-12-25 14:00</code> - ${ctx.t('orders.edit.start_specific')}\n` +
        `• <code>+2h</code> - ${ctx.t('orders.edit.start_relative_hours')}\n` +
        `• <code>+30m</code> - ${ctx.t('orders.edit.start_relative_minutes')}`;

      await this.messageService.sendOrEditMessage(ctx, {
        text: message,
        parseMode: 'HTML',
        replyMarkup: this.createBackKeyboard(ctx, orderId),
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error handling edit start time', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle edit schedule - shows day selection keyboard
   */
  private async handleEditSchedule(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:edit:schedule:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      // Get current schedule from order config
      // Convert OrderSchedule to boolean[] for UI (daysOfWeek: 0-6 for Mon-Sun)
      const { schedule } = order.config;
      const daysEnabled = schedule?.daysOfWeek
        ? [0, 1, 2, 3, 4, 5, 6].map((day) => schedule.daysOfWeek?.includes(day) ?? true)
        : [true, true, true, true, true, true, true];

      const message =
        `<b>${ctx.t('orders.edit.schedule_title')}</b>\n\n` +
        `${ctx.t('orders.edit.schedule_prompt')}\n\n` +
        `<i>${ctx.t('orders.edit.schedule_hint')}</i>`;

      const keyboard = this.createScheduleKeyboard(ctx, orderId, daysEnabled);

      await this.messageService.sendOrEditMessage(ctx, {
        text: message,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error handling edit schedule', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Create schedule configuration keyboard
   */
  private createScheduleKeyboard(ctx: BotContext, orderId: string, schedule: boolean[]): InlineKeyboard {
    const dayNames = [
      ctx.t('common.days.mon'),
      ctx.t('common.days.tue'),
      ctx.t('common.days.wed'),
      ctx.t('common.days.thu'),
      ctx.t('common.days.fri'),
      ctx.t('common.days.sat'),
      ctx.t('common.days.sun'),
    ];

    const keyboard = new InlineKeyboard();

    // First row: Mon, Tue, Wed, Thu
    dayNames.slice(0, 4).forEach((day, idx) => {
      const emoji = schedule[idx] ? '✅' : '❌';
      keyboard.text(`${emoji} ${day}`, `order:schedule:day:${idx}:${orderId}`);
    });

    keyboard.row();

    // Second row: Fri, Sat, Sun
    dayNames.slice(4).forEach((day, idx) => {
      const actualIdx = idx + 4;
      const emoji = schedule[actualIdx] ? '✅' : '❌';
      keyboard.text(`${emoji} ${day}`, `order:schedule:day:${actualIdx}:${orderId}`);
    });

    keyboard.row();

    // Save and back buttons
    keyboard.text(ctx.t('common.buttons.save'), `order:schedule:save:${orderId}`).row();
    keyboard.text(ctx.t('common.back'), `order:config:start:${orderId}`);

    return keyboard;
  }

  /**
   * Handle schedule day toggle
   */
  private async handleScheduleDayToggle(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:schedule:day:(\d):(.+)$/);
      const dayIndex = match?.[1] ? parseInt(match[1], 10) : null;
      const orderId = match?.[2];

      if (dayIndex === null || !orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      // Toggle day in schedule
      // Convert OrderSchedule to boolean[] for manipulation
      const { schedule } = order.config;
      const daysEnabled = schedule?.daysOfWeek
        ? [0, 1, 2, 3, 4, 5, 6].map((day) => schedule.daysOfWeek?.includes(day) ?? true)
        : [true, true, true, true, true, true, true];

      daysEnabled[dayIndex] = !daysEnabled[dayIndex];

      // Convert back to OrderSchedule format
      const newDaysOfWeek = daysEnabled.map((enabled, idx) => (enabled ? idx : -1)).filter((day) => day >= 0);

      const newSchedule = {
        type: schedule?.type ?? ('weekly' as const),
        daysOfWeek: newDaysOfWeek,
        time: schedule?.time ?? '09:00',
        endCondition: schedule?.endCondition ?? { never: true },
      };

      // Update order config
      await this.orderService.updateOrderConfig(orderId, { schedule: newSchedule });

      // Refresh keyboard
      const keyboard = this.createScheduleKeyboard(ctx, orderId, daysEnabled);

      await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error toggling schedule day', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle schedule save
   */
  private async handleScheduleSave(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:schedule:save:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      await ctx.answerCallbackQuery(ctx.t('common.success.saved'));

      // Return to configuration screen
      const keyboard = createConfigurationKeyboard(ctx, orderId);

      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.edit_prompt'),
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });
    } catch (error) {
      this.logger.error('Error saving schedule', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle text message input for edit operations
   */
  private async handleTextMessage(ctx: BotContext): Promise<void> {
    if (!isAuthenticated(ctx)) {
      return;
    }

    const formData = this.getEditFormData(ctx);
    if (!formData) {
      return;
    }

    const { orderId, field } = formData;
    const input = ctx.message?.text || '';

    try {
      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await this.messageService.sendNewMessage(ctx, { text: ctx.t('common.errors.access_denied') });
        this.clearEditSession(ctx);

        return;
      }

      // Route to appropriate handler based on field
      const fieldHandlers: Record<OrderEditField, () => Promise<void>> = {
        name: () => this.processNameInput(ctx, orderId, input),
        link: () => this.processLinkInput(ctx, orderId, input),
        daily: () => this.processNumericInput(ctx, orderId, 'usersPerDay', input),
        total: () => this.processNumericInput(ctx, orderId, 'totalUsers', input),
        price: () => this.processPriceInput(ctx, orderId, input),
        startTime: () => this.processStartTimeInput(ctx, orderId, input),
        schedule: () => Promise.resolve(), // Schedule is handled via callbacks
      };

      const handler = fieldHandlers[field];
      if (handler) {
        await handler();
      }
    } catch (error) {
      this.logger.error('Error processing edit input', { error, orderId, field });
      await this.messageService.sendNewMessage(ctx, { text: ctx.t('common.error') });
      this.clearEditSession(ctx);
    }
  }

  /**
   * Process name input
   */
  private async processNameInput(ctx: AuthenticatedBotContext, orderId: string, input: string): Promise<void> {
    const name = input.trim();

    if (name.length === 0) {
      await this.messageService.sendNewMessage(ctx, { text: ctx.t('orders.edit.name_empty') });

      return;
    }

    if (name.length > 100) {
      await this.messageService.sendNewMessage(ctx, { text: ctx.t('orders.edit.name_too_long') });

      return;
    }

    await this.orderService.updateOrderConfig(orderId, { name });
    this.clearEditSession(ctx);

    await this.messageService.sendNewMessage(ctx, { text: ctx.t('orders.edit.name_updated', { name }) });

    // Show configuration menu
    const keyboard = createConfigurationKeyboard(ctx, orderId);
    await this.messageService.sendNewMessage(ctx, {
      text: ctx.t('orders.edit_prompt'),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  /**
   * Process link input
   */
  private async processLinkInput(ctx: AuthenticatedBotContext, orderId: string, input: string): Promise<void> {
    const link = input.trim();

    // Validate link format
    const validation = await this.orderService.validateChannelLink(link);
    if (!validation.valid) {
      await this.messageService.sendNewMessage(ctx, { text: ctx.t('bot.order.invalid_link') });

      return;
    }

    // Verify channel exists
    const channel = await this.orderService.getChannelInfo(link);
    if (!channel) {
      await this.messageService.sendNewMessage(ctx, { text: ctx.t('bot.order.channel_not_found') });

      return;
    }

    await this.orderService.updateOrderConfig(orderId, { channelLink: link });
    this.clearEditSession(ctx);

    await this.messageService.sendNewMessage(ctx, { text: ctx.t('orders.edit.link_updated', { link }) });

    // Show configuration menu
    const keyboard = createConfigurationKeyboard(ctx, orderId);
    await this.messageService.sendNewMessage(ctx, {
      text: ctx.t('orders.edit_prompt'),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  /**
   * Process numeric input (daily users, total users)
   */
  private async processNumericInput(
    ctx: AuthenticatedBotContext,
    orderId: string,
    fieldName: 'usersPerDay' | 'totalUsers',
    input: string,
  ): Promise<void> {
    const value = parseInt(input.trim(), 10);

    if (isNaN(value) || value < 0) {
      await this.messageService.sendNewMessage(ctx, { text: ctx.t('orders.edit.invalid_number') });

      return;
    }

    if (value > 1000000) {
      await this.messageService.sendNewMessage(ctx, { text: ctx.t('orders.edit.number_too_large') });

      return;
    }

    await this.orderService.updateOrderConfig(orderId, { [fieldName]: value });
    this.clearEditSession(ctx);

    const messageKey = fieldName === 'usersPerDay' ? 'orders.edit.daily_updated' : 'orders.edit.total_updated';
    await this.messageService.sendNewMessage(ctx, { text: ctx.t(messageKey, { value }) });

    // Show configuration menu
    const keyboard = createConfigurationKeyboard(ctx, orderId);
    await this.messageService.sendNewMessage(ctx, {
      text: ctx.t('orders.edit_prompt'),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  /**
   * Process price input
   */
  private async processPriceInput(ctx: AuthenticatedBotContext, orderId: string, input: string): Promise<void> {
    const cleanInput = input.trim().replace(/[$,]/g, '');
    const price = decimal(cleanInput);

    if (price.isNaN() || lessThan(price, decimal(0))) {
      await this.messageService.sendNewMessage(ctx, { text: ctx.t('orders.edit.invalid_price') });

      return;
    }

    if (greaterThan(price, decimal(1000))) {
      await this.messageService.sendNewMessage(ctx, { text: ctx.t('orders.edit.price_too_high') });

      return;
    }

    const priceValue = toNumber(price);
    await this.orderService.updateOrderConfig(orderId, { pricePerSubscriber: priceValue });
    this.clearEditSession(ctx);

    await this.messageService.sendNewMessage(ctx, { text: ctx.t('orders.edit.price_updated', { price: priceValue }) });

    // Show configuration menu
    const keyboard = createConfigurationKeyboard(ctx, orderId);
    await this.messageService.sendNewMessage(ctx, {
      text: ctx.t('orders.edit_prompt'),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  /**
   * Process start time input
   */
  private async processStartTimeInput(ctx: AuthenticatedBotContext, orderId: string, input: string): Promise<void> {
    const cleanInput = input.trim().toLowerCase();
    let startTime: Date | null = null;

    // Parse input
    if (cleanInput === 'now') {
      startTime = new Date();
    } else if (cleanInput.startsWith('+')) {
      // Relative time: +2h, +30m
      const match = cleanInput.match(/^\+(\d+)([hm])$/);
      if (match) {
        const [, valueStr, unit] = match;
        const value = parseInt(valueStr, 10);
        startTime = new Date();
        if (unit === 'h') {
          startTime.setHours(startTime.getHours() + value);
        } else {
          startTime.setMinutes(startTime.getMinutes() + value);
        }
      }
    } else {
      // Try to parse as date string
      const parsed = new Date(cleanInput);
      if (!isNaN(parsed.getTime())) {
        startTime = parsed;
      }
    }

    if (!startTime) {
      await this.messageService.sendNewMessage(ctx, { text: ctx.t('orders.edit.invalid_time_format') });

      return;
    }

    if (startTime < new Date()) {
      await this.messageService.sendNewMessage(ctx, { text: ctx.t('orders.edit.time_in_past') });

      return;
    }

    await this.orderService.updateOrderConfig(orderId, { startTime });
    this.clearEditSession(ctx);

    await this.messageService.sendNewMessage(ctx, {
      text: ctx.t('orders.edit.start_time_updated', { time: this.messageService.formatDateTime(ctx, startTime) }),
    });

    // Show configuration menu
    const keyboard = createConfigurationKeyboard(ctx, orderId);
    await this.messageService.sendNewMessage(ctx, {
      text: ctx.t('orders.edit_prompt'),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }
}
