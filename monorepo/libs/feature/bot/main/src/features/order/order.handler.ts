/**
 * Order Handler
 *
 * Handles all order-related interactions and flows
 */

import { Injectable, Logger } from '@nestjs/common';
import { Composer } from 'grammy';
import { BotContext } from '@app/feature-bot-shared';
import { OrderService } from './order.service';
import { OrderFlowStep, OrderStatus } from './order.types';
import {
  createMainMenuKeyboard,
  createOrderListKeyboard,
  createChannelLinkHelpKeyboard,
  createAddBotAdminKeyboard,
  createModerationKeyboard,
  createConfigurationKeyboard,
  createViewOrderKeyboard,
  createDeleteConfirmKeyboard,
  createStatsKeyboard,
  createAudienceConfigKeyboard,
  createGenderKeyboard,
  createTopicsKeyboard,
  createLocationKeyboard,
} from './order.keyboards';
import {
  getMainMenuMessage,
  getOrderListMessage,
  getChannelLinkInputMessage,
  getAddBotAdminMessage,
  getModerationMessage,
  getConfigurationMessage,
  getViewOrderMessage,
  getOrderStatsMessage,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from './order.messages';

@Injectable()
export class OrderHandler {
  private readonly logger = new Logger(OrderHandler.name);
  private composer: Composer<BotContext>;
  private readonly BOT_USERNAME = 'subgram_checksub_1_bot';

  constructor(private readonly orderService: OrderService) {
    this.composer = new Composer<BotContext>();
    this.setupHandlers();
  }

  /**
   * Get Grammy composer
   */
  getComposer(): Composer<BotContext> {
    return this.composer;
  }

  /**
   * Setup all handlers
   */
  private setupHandlers(): void {
    // Main menu
    this.composer.callbackQuery('menu:main', ctx => this.handleMainMenu(ctx));

    // Order list
    this.composer.callbackQuery('order:list', ctx => this.handleOrderList(ctx));
    this.composer.callbackQuery('order:deleted', ctx => this.handleDeletedOrders(ctx));

    // Order creation flow
    this.composer.callbackQuery('order:create:start', ctx => this.handleStartOrderCreation(ctx));
    this.composer.callbackQuery('order:create:back', ctx => this.handleOrderList(ctx));

    // Bot admin check
    this.composer.callbackQuery('order:bot:check', ctx => this.handleBotAdminCheck(ctx));
    this.composer.callbackQuery('order:bot:skip', ctx => this.handleBotAdminSkip(ctx));

    // Configuration
    this.composer.callbackQuery(/^order:config:start:(.+)$/, ctx => this.handleOrderConfig(ctx));
    this.composer.callbackQuery(/^order:config:skip:(.+)$/, ctx => this.handleConfigSkip(ctx));
    this.composer.callbackQuery(/^order:config:done:(.+)$/, ctx => this.handleConfigDone(ctx));

    // View order
    this.composer.callbackQuery(/^order:view:(.+)$/, ctx => this.handleViewOrder(ctx));
    this.composer.callbackQuery(/^order:refresh:(.+)$/, ctx => this.handleRefreshStats(ctx));
    this.composer.callbackQuery(/^order:stats:(.+)$/, ctx => this.handleOrderStats(ctx));

    // Order actions
    this.composer.callbackQuery(/^order:toggle:(.+)$/, ctx => this.handleToggleOrder(ctx));
    this.composer.callbackQuery(/^order:delete:(.+)$/, ctx => this.handleDeleteOrder(ctx));
    this.composer.callbackQuery(/^order:delete:confirm:(.+)$/, ctx => this.handleDeleteConfirm(ctx));
    this.composer.callbackQuery(/^order:duplicate:(.+)$/, ctx => this.handleDuplicateOrder(ctx));

    // Configuration editing
    this.composer.callbackQuery(/^order:edit:name:(.+)$/, ctx => this.handleEditName(ctx));
    this.composer.callbackQuery(/^order:edit:daily:(.+)$/, ctx => this.handleEditDaily(ctx));
    this.composer.callbackQuery(/^order:edit:total:(.+)$/, ctx => this.handleEditTotal(ctx));
    this.composer.callbackQuery(/^order:edit:price:(.+)$/, ctx => this.handleEditPrice(ctx));
    this.composer.callbackQuery(/^order:edit:audience:(.+)$/, ctx => this.handleEditAudience(ctx));
    this.composer.callbackQuery(/^order:edit:topics:(.+)$/, ctx => this.handleEditTopics(ctx));
    this.composer.callbackQuery(/^order:edit:locations:(.+)$/, ctx => this.handleEditLocations(ctx));

    // Toggles
    this.composer.callbackQuery(/^order:toggle:distribute:(.+)$/, ctx => this.handleToggleDistribute(ctx));
    this.composer.callbackQuery(/^order:toggle:unsubscribes:(.+)$/, ctx => this.handleToggleUnsubscribes(ctx));

    // Text message handlers for order creation flow
    this.composer.on('message:text', ctx => this.handleTextMessage(ctx));
  }

  /**
   * Handle main menu
   */
  private async handleMainMenu(ctx: BotContext): Promise<void> {
    try {
      const message = getMainMenuMessage();
      const keyboard = createMainMenuKeyboard();

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error handling main menu', error);
      await ctx.answerCallbackQuery('❌ Ошибка загрузки меню');
    }
  }

  /**
   * Handle order list
   */
  private async handleOrderList(ctx: BotContext): Promise<void> {
    try {
      const userId = ctx.from?.id.toString();
      if (!userId) {
        await ctx.answerCallbackQuery('❌ Ошибка аутентификации');
        return;
      }

      const orders = await this.orderService.getUserOrders(userId);
      const activeOrders = orders.filter(o => o.status !== OrderStatus.Deleted);

      const message = getOrderListMessage(activeOrders.length);
      const keyboard = createOrderListKeyboard(activeOrders);

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error handling order list', error);
      await ctx.answerCallbackQuery('❌ Ошибка загрузки заказов');
    }
  }

  /**
   * Handle deleted orders
   */
  private async handleDeletedOrders(ctx: BotContext): Promise<void> {
    try {
      const userId = ctx.from?.id.toString();
      if (!userId) {
        await ctx.answerCallbackQuery('❌ Ошибка аутентификации');
        return;
      }

      const orders = await this.orderService.getUserOrders(userId);
      const deletedOrders = orders.filter(o => o.status === OrderStatus.Deleted);

      const message = `<b>Удаленные заказы</b>\n\nВсего: ${deletedOrders.length}`;
      const keyboard = createOrderListKeyboard(deletedOrders, true);

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error handling deleted orders', error);
      await ctx.answerCallbackQuery('❌ Ошибка загрузки удаленных заказов');
    }
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
   * Handle text messages (used for channel link input and other text inputs)
   */
  private async handleTextMessage(ctx: BotContext): Promise<void> {
    const state = this.orderService.getOrderSessionState(ctx);
    if (!state) {
      return; // Not in order creation flow
    }

    const text = ctx.message?.text || '';

    try {
      switch (state.currentStep) {
        case OrderFlowStep.EnterChannelLink:
          await this.handleChannelLinkInput(ctx, text);
          break;

        default:
          // Other text inputs can be handled here
          break;
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
   * Handle order configuration (A5)
   */
  private async handleOrderConfig(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:config:start:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка: заказ не найден');
        return;
      }

      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        await ctx.answerCallbackQuery('❌ Заказ не найден');
        return;
      }

      const message = getConfigurationMessage(order);
      const keyboard = createConfigurationKeyboard(orderId);

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery('⚙️ Настройки заказа');
    } catch (error) {
      this.logger.error('Error handling order config', error);
      await ctx.answerCallbackQuery('❌ Ошибка загрузки настроек');
    }
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

      // Clear session state
      this.orderService.clearOrderSessionState(ctx);

      // Show order view (A6)
      await this.showOrderView(ctx, orderId);

      await ctx.answerCallbackQuery('✅ Использованы настройки по умолчанию');
    } catch (error) {
      this.logger.error('Error skipping config', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
  }

  /**
   * Handle config done (A6: View order)
   */
  private async handleConfigDone(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:config:done:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      // Clear session state
      this.orderService.clearOrderSessionState(ctx);

      // Show order view (A6)
      await this.showOrderView(ctx, orderId);

      await ctx.answerCallbackQuery(SUCCESS_MESSAGES.configSaved);
    } catch (error) {
      this.logger.error('Error finishing config', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
  }

  /**
   * Show order view (A6)
   */
  private async showOrderView(ctx: BotContext, orderId: string): Promise<void> {
    const order = await this.orderService.getOrderById(orderId);
    if (!order) {
      await ctx.answerCallbackQuery('❌ Заказ не найден');
      return;
    }

    // TODO: Get real user balance
    const balance = 1234.50;

    const message = getViewOrderMessage(order, balance);
    const keyboard = createViewOrderKeyboard(order);

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  }

  /**
   * Handle view order
   */
  private async handleViewOrder(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:view:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      await this.showOrderView(ctx, orderId);
      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error viewing order', error);
      await ctx.answerCallbackQuery('❌ Ошибка просмотра заказа');
    }
  }

  /**
   * Handle refresh statistics
   */
  private async handleRefreshStats(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:refresh:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      await this.orderService.refreshOrderStats(orderId);
      await this.showOrderView(ctx, orderId);
      await ctx.answerCallbackQuery('✅ Статистика обновлена');
    } catch (error) {
      this.logger.error('Error refreshing stats', error);
      await ctx.answerCallbackQuery('❌ Ошибка обновления статистики');
    }
  }

  /**
   * Handle order statistics view
   */
  private async handleOrderStats(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:stats:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        await ctx.answerCallbackQuery('❌ Заказ не найден');
        return;
      }

      const message = getOrderStatsMessage(order);
      const keyboard = createStatsKeyboard(orderId);

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error showing stats', error);
      await ctx.answerCallbackQuery('❌ Ошибка загрузки статистики');
    }
  }

  /**
   * Handle toggle order (start/stop)
   */
  private async handleToggleOrder(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:toggle:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        await ctx.answerCallbackQuery('❌ Заказ не найден');
        return;
      }

      const newStatus = order.status === OrderStatus.Active ? OrderStatus.Paused : OrderStatus.Active;
      await this.orderService.updateOrderStatus(orderId, newStatus);

      await this.showOrderView(ctx, orderId);

      const message = newStatus === OrderStatus.Active ? SUCCESS_MESSAGES.orderStarted : SUCCESS_MESSAGES.orderStopped;
      await ctx.answerCallbackQuery(message);
    } catch (error) {
      this.logger.error('Error toggling order', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
  }

  /**
   * Handle delete order
   */
  private async handleDeleteOrder(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:delete:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        await ctx.answerCallbackQuery('❌ Заказ не найден');
        return;
      }

      const message = `⚠️ Удалить заказ?\n\nЗаказ: ${order.config.name}\nКанал: ${order.channel.title}\n\nЭто действие нельзя отменить.`;
      const keyboard = createDeleteConfirmKeyboard(orderId);

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error showing delete confirmation', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
  }

  /**
   * Handle delete confirmation
   */
  private async handleDeleteConfirm(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:delete:confirm:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      await this.orderService.deleteOrder(orderId);
      await this.handleOrderList(ctx);
      await ctx.answerCallbackQuery(SUCCESS_MESSAGES.orderDeleted);
    } catch (error) {
      this.logger.error('Error deleting order', error);
      await ctx.answerCallbackQuery('❌ Ошибка удаления заказа');
    }
  }

  /**
   * Handle duplicate order
   */
  private async handleDuplicateOrder(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:duplicate:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      const userId = ctx.from?.id.toString();
      if (!userId) {
        await ctx.answerCallbackQuery('❌ Ошибка аутентификации');
        return;
      }

      const duplicated = await this.orderService.duplicateOrder(orderId, userId);
      if (!duplicated) {
        await ctx.answerCallbackQuery('❌ Не удалось скопировать заказ');
        return;
      }

      await this.showOrderView(ctx, duplicated.id);
      await ctx.answerCallbackQuery('✅ Заказ скопирован');
    } catch (error) {
      this.logger.error('Error duplicating order', error);
      await ctx.answerCallbackQuery('❌ Ошибка копирования заказа');
    }
  }

  /**
   * Handle edit name (placeholder - needs text input handling)
   */
  private async handleEditName(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('📝 Функция в разработке');
  }

  /**
   * Handle edit daily users (placeholder)
   */
  private async handleEditDaily(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('📊 Функция в разработке');
  }

  /**
   * Handle edit total users (placeholder)
   */
  private async handleEditTotal(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('📈 Функция в разработке');
  }

  /**
   * Handle edit price (placeholder)
   */
  private async handleEditPrice(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('💸 Функция в разработке');
  }

  /**
   * Handle edit audience
   */
  private async handleEditAudience(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:edit:audience:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      const keyboard = createAudienceConfigKeyboard(orderId);
      const message = '<b>Настройка аудитории</b>\n\nВыберите параметр для настройки:';

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error editing audience', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
  }

  /**
   * Handle edit topics
   */
  private async handleEditTopics(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:edit:topics:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        await ctx.answerCallbackQuery('❌ Заказ не найден');
        return;
      }

      const keyboard = createTopicsKeyboard(orderId, order.config.excludedTopics);
      const message = '<b>Исключенные тематики</b>\n\nВыберите тематики, из которых НЕ нужно привлекать подписчиков:';

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error editing topics', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
  }

  /**
   * Handle edit locations
   */
  private async handleEditLocations(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:edit:locations:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      const keyboard = createLocationKeyboard(orderId);
      const message = '<b>Места показов</b>\n\nВыберите где показывать рекламу:';

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error editing locations', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
  }

  /**
   * Handle toggle distribute
   */
  private async handleToggleDistribute(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('🕐 Функция в разработке');
  }

  /**
   * Handle toggle unsubscribes
   */
  private async handleToggleUnsubscribes(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('📉 Функция в разработке');
  }
}
