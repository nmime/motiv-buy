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
  createAudienceConfigKeyboard,
  createConfigurationKeyboard,
  createGenderKeyboard,
  createLocationKeyboard,
  createTopicsKeyboard,
} from '../order.keyboards';
import { OrderDisplayLocation, UserGender } from '../order.types';

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
    this.composer.callbackQuery(/^order:config:start:([^:]+)$/, (ctx) => this.handleOrderConfig(ctx));
    this.composer.callbackQuery(/^order:config:done:([^:]+)$/, (ctx) => this.handleConfigDone(ctx));

    // Audience configuration
    this.composer.callbackQuery(/^order:edit:audience:([^:]+)$/, (ctx) => this.handleEditAudience(ctx));
    this.composer.callbackQuery(/^order:audience:gender:([^:]+)$/, (ctx) => this.handleAudienceGender(ctx));
    this.composer.callbackQuery(/^order:gender:([^:]+):([^:]+)$/, (ctx) => this.handleGenderSelection(ctx));

    // Topics configuration

    this.composer.callbackQuery(/^order:edit:topics:([^:]+)$/, (ctx) => this.handleEditTopics(ctx));
    this.composer.callbackQuery(/^order:topic:([^:]+):([^:]+)$/, (ctx) => this.handleTopicToggle(ctx));
    this.composer.callbackQuery(/^order:topics:save:([^:]+)$/, (ctx) => this.handleTopicsSave(ctx));

    // Locations configuration
    this.composer.callbackQuery(/^order:edit:locations:([^:]+)$/, (ctx) => this.handleEditLocations(ctx));
    this.composer.callbackQuery(/^order:location:([^:]+):([^:]+)$/, (ctx) => this.handleLocationSelection(ctx));

    // Toggles
    this.composer.callbackQuery(/^order:toggle:distribute:([^:]+)$/, (ctx) => this.handleToggleDistribute(ctx));
    this.composer.callbackQuery(/^order:toggle:unsubscribes:([^:]+)$/, (ctx) => this.handleToggleUnsubscribes(ctx));
  }

  /**
   * Handle order configuration (A5)
   */
  private async handleOrderConfig(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:config:start:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.not_found'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        await ctx.answerCallbackQuery(ctx.t('bot.order.order_not_found'));

        return;
      }

      if (order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      const message = `${ctx.t('bot.configuration.title')}\n\n${ctx.t('bot.configuration.basic_settings')}\n${ctx.t('bot.configuration.name')} ${order.config.name || ''}\n${ctx.t('bot.configuration.link')} ${order.config.channelLink || ''}`;
      const keyboard = createConfigurationKeyboard(orderId);

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery(ctx.t('bot.configuration.title'));
    } catch (error) {
      this.logger.error('Error handling order config', error);
      await ctx.answerCallbackQuery(ctx.t('common.errors.load_failed'));
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
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      // Clear session state
      this.orderService.clearOrderSessionState(ctx);

      await ctx.answerCallbackQuery(ctx.t('bot.order.config_saved'));
    } catch (error) {
      this.logger.error('Error finishing config', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
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
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      const keyboard = createAudienceConfigKeyboard(orderId);
      const message = `<b>${ctx.t('bot.configuration.targeting')}</b>\n\n${ctx.t('bot.configuration.targeting')}:`;

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error editing audience', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
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
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      const keyboard = createGenderKeyboard(orderId);
      const message = `<b>${ctx.t('bot.configuration.gender')}:</b>`;

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error showing gender selection', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle gender selection
   */
  private async handleGenderSelection(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:gender:([^:]+):([^:]+)$/);
      const gender = match?.[1];
      const orderId = match?.[2];

      if (!gender || !orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check and update
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      await this.orderService.updateOrderConfig(orderId, {
        targetAudience: {
          ...order.config.targetAudience,
          gender: gender as UserGender,
        },
      });

      await this.handleEditAudience(ctx);
      await ctx.answerCallbackQuery(ctx.t('common.success.saved'));
    } catch (error) {
      this.logger.error('Error saving gender', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
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
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.not_found'));

        return;
      }

      if (order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      const keyboard = createTopicsKeyboard(orderId, order.config.excludedTopics);
      const message = `<b>${ctx.t('bot.configuration.excluded_topics')}</b>\n\n${ctx.t('bot.configuration.excluded_topics')}:`;

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error editing topics', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle topic toggle
   */
  private async handleTopicToggle(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:topic:([^:]+):([^:]+)$/);
      const topicId = match?.[1];
      const orderId = match?.[2];

      if (!topicId || !orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

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
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle topics save
   */
  private async handleTopicsSave(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery(ctx.t('common.success.saved'));
  }

  /**
   * Handle edit locations
   */
  private async handleEditLocations(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:edit:locations:(.+)$/);
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

      const keyboard = createLocationKeyboard(orderId);
      const message = `<b>${ctx.t('bot.configuration.display_locations')}</b>\n\n${ctx.t('bot.configuration.display_locations')}:`;

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error editing locations', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle location selection
   */
  private async handleLocationSelection(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:location:([^:]+):([^:]+)$/);
      const location = match?.[1];
      const orderId = match?.[2];

      if (!location || !orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check and update
      const order = await this.orderService.getOrderById(orderId);

      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      await this.orderService.updateOrderConfig(orderId, {
        displayLocation: location as OrderDisplayLocation,
      });

      await this.handleOrderConfig(ctx);
      await ctx.answerCallbackQuery(ctx.t('common.success.saved'));
    } catch (error) {
      this.logger.error('Error saving location', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
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
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      await this.orderService.updateOrderConfig(orderId, {
        distributeDaily: !order.config.distributeDaily,
      });

      await this.handleOrderConfig(ctx);
      await ctx.answerCallbackQuery(ctx.t('common.success.updated'));
    } catch (error) {
      this.logger.error('Error toggling distribute', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
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
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      await this.orderService.updateOrderConfig(orderId, {
        accountUnsubscribes: !order.config.accountUnsubscribes,
      });

      await this.handleOrderConfig(ctx);
      await ctx.answerCallbackQuery(ctx.t('common.success.updated'));
    } catch (error) {
      this.logger.error('Error toggling unsubscribes', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }
}
