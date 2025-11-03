/**
 * Order Configuration Handler
 *
 * Handles order configuration screens and settings:
 * - A5: Configuration menu
 * - Configuration completion
 */

import { Injectable, Logger } from '@nestjs/common';
import { Composer } from 'grammy';
import { BotContext } from '@app/feature-bot-shared';
import { OrderService } from '../order.service';
import {
  createConfigurationKeyboard,
  createAudienceConfigKeyboard,
  createGenderKeyboard,
  createTopicsKeyboard,
  createLocationKeyboard,
} from '../order.keyboards';
import {
  getConfigurationMessage,
  SUCCESS_MESSAGES,
} from '../order.messages';

@Injectable()
export class OrderConfigHandler {
  private readonly logger = new Logger(OrderConfigHandler.name);
  private composer: Composer<BotContext>;

  constructor(private readonly orderService: OrderService) {
    this.composer = new Composer<BotContext>();
    this.setupHandlers();
  }

  getComposer(): Composer<BotContext> {
    return this.composer;
  }

  private setupHandlers(): void {
    // Configuration
    this.composer.callbackQuery(/^order:config:start:(.+)$/, ctx => this.handleOrderConfig(ctx));
    this.composer.callbackQuery(/^order:config:done:(.+)$/, ctx => this.handleConfigDone(ctx));

    // Audience configuration
    this.composer.callbackQuery(/^order:edit:audience:(.+)$/, ctx => this.handleEditAudience(ctx));
    this.composer.callbackQuery(/^order:audience:gender:(.+)$/, ctx => this.handleAudienceGender(ctx));
    this.composer.callbackQuery(/^order:gender:(.+):(.+)$/, ctx => this.handleGenderSelection(ctx));

    // Topics configuration
    this.composer.callbackQuery(/^order:edit:topics:(.+)$/, ctx => this.handleEditTopics(ctx));
    this.composer.callbackQuery(/^order:topic:(.+):(.+)$/, ctx => this.handleTopicToggle(ctx));
    this.composer.callbackQuery(/^order:topics:save:(.+)$/, ctx => this.handleTopicsSave(ctx));

    // Locations configuration
    this.composer.callbackQuery(/^order:edit:locations:(.+)$/, ctx => this.handleEditLocations(ctx));
    this.composer.callbackQuery(/^order:location:(.+):(.+)$/, ctx => this.handleLocationSelection(ctx));

    // Toggles
    this.composer.callbackQuery(/^order:toggle:distribute:(.+)$/, ctx => this.handleToggleDistribute(ctx));
    this.composer.callbackQuery(/^order:toggle:unsubscribes:(.+)$/, ctx => this.handleToggleUnsubscribes(ctx));
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

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        await ctx.answerCallbackQuery('❌ Заказ не найден');
        return;
      }

      if (order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery('❌ Доступ запрещен');
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

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery('❌ Доступ запрещен');
        return;
      }

      // Clear session state
      this.orderService.clearOrderSessionState(ctx);

      await ctx.answerCallbackQuery(SUCCESS_MESSAGES.configSaved);
    } catch (error) {
      this.logger.error('Error finishing config', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
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

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery('❌ Доступ запрещен');
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
   * Handle audience gender selection
   */
  private async handleAudienceGender(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:audience:gender:(.+)$/);
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

      const keyboard = createGenderKeyboard(orderId);
      const message = '<b>Выберите пол:</b>';

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error showing gender selection', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
  }

  /**
   * Handle gender selection
   */
  private async handleGenderSelection(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:gender:(.+):(.+)$/);
      const gender = match?.[1];
      const orderId = match?.[2];

      if (!gender || !orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      // Authorization check and update
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery('❌ Доступ запрещен');
        return;
      }

      await this.orderService.updateOrderConfig(orderId, {
        targetAudience: {
          ...order.config.targetAudience,
          gender: gender as any,
        },
      });

      await this.handleEditAudience(ctx);
      await ctx.answerCallbackQuery('✅ Пол сохранен');
    } catch (error) {
      this.logger.error('Error saving gender', error);
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

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        await ctx.answerCallbackQuery('❌ Заказ не найден');
        return;
      }

      if (order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery('❌ Доступ запрещен');
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
   * Handle topic toggle
   */
  private async handleTopicToggle(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:topic:(.+):(.+)$/);
      const topicId = match?.[1];
      const orderId = match?.[2];

      if (!topicId || !orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery('❌ Доступ запрещен');
        return;
      }

      // Toggle topic in excluded list
      const excludedTopics = order.config.excludedTopics || [];
      const index = excludedTopics.indexOf(topicId);

      if (index === -1) {
        excludedTopics.push(topicId);
      } else {
        excludedTopics.splice(index, 1);
      }

      await this.orderService.updateOrderConfig(orderId, {
        excludedTopics,
      });

      // Refresh the topics screen
      await this.handleEditTopics(ctx);
    } catch (error) {
      this.logger.error('Error toggling topic', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
  }

  /**
   * Handle topics save
   */
  private async handleTopicsSave(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('✅ Тематики сохранены');
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

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery('❌ Доступ запрещен');
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
   * Handle location selection
   */
  private async handleLocationSelection(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:location:(.+):(.+)$/);
      const location = match?.[1];
      const orderId = match?.[2];

      if (!location || !orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      // Authorization check and update
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery('❌ Доступ запрещен');
        return;
      }

      await this.orderService.updateOrderConfig(orderId, {
        displayLocation: location as any,
      });

      await this.handleOrderConfig(ctx);
      await ctx.answerCallbackQuery('✅ Места показов сохранены');
    } catch (error) {
      this.logger.error('Error saving location', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
  }

  /**
   * Handle toggle distribute
   */
  private async handleToggleDistribute(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:toggle:distribute:(.+)$/);
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

      await this.orderService.updateOrderConfig(orderId, {
        distributeDaily: !order.config.distributeDaily,
      });

      await this.handleOrderConfig(ctx);
      await ctx.answerCallbackQuery('✅ Настройка обновлена');
    } catch (error) {
      this.logger.error('Error toggling distribute', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
  }

  /**
   * Handle toggle unsubscribes
   */
  private async handleToggleUnsubscribes(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:toggle:unsubscribes:(.+)$/);
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

      await this.orderService.updateOrderConfig(orderId, {
        accountUnsubscribes: !order.config.accountUnsubscribes,
      });

      await this.handleOrderConfig(ctx);
      await ctx.answerCallbackQuery('✅ Настройка обновлена');
    } catch (error) {
      this.logger.error('Error toggling unsubscribes', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
  }
}
