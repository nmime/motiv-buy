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
import { BotOrderService } from './bot-order.service';
import {
  createAudienceConfigKeyboard,
  createConfigurationKeyboard,
  createGenderKeyboard,
  createLocationKeyboard,
  createOrderCategoryKeyboard,
  createTopicsKeyboard,
} from './order.keyboards';
import { OrderDisplayLocation, UserGender } from '@app/feature-order-shared';
import { MessageService } from '../../service/message.service';
import { TopicCategory } from '@app/database';

@Injectable()
export class OrderConfigHandler {
  private readonly logger = new Logger(OrderConfigHandler.name);
  private composer: Composer<BotContext>;

  constructor(
    private readonly orderService: BotOrderService,
    private readonly messageService: MessageService,
  ) {
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

    // Categories configuration
    this.composer.callbackQuery(/^order:edit:categories:([^:]+)$/, (ctx) => this.handleEditCategories(ctx));
    this.composer.callbackQuery(/^order:cat:([^:]+):([^:]+)$/, (ctx) => this.handleCategoryToggle(ctx));
    this.composer.callbackQuery(/^order:catpage:(\d+):([^:]+)$/, (ctx) => this.handleCategoryPage(ctx));
    this.composer.callbackQuery(/^order:catall:([^:]+)$/, (ctx) => this.handleCategorySelectAll(ctx));
    this.composer.callbackQuery(/^order:catclear:([^:]+)$/, (ctx) => this.handleCategoryClear(ctx));
    this.composer.callbackQuery(/^order:catsave:([^:]+)$/, (ctx) => this.handleCategorySave(ctx));

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
      const keyboard = createConfigurationKeyboard(ctx, orderId);

      await this.messageService.sendOrEditMessage(ctx, {
        text: message,
        parseMode: 'HTML',
        replyMarkup: keyboard,
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

      const keyboard = createAudienceConfigKeyboard(ctx, orderId);
      const message = `<b>${ctx.t('bot.configuration.targeting')}</b>\n\n${ctx.t('bot.configuration.targeting')}:`;

      await this.messageService.sendOrEditMessage(ctx, {
        text: message,
        parseMode: 'HTML',
        replyMarkup: keyboard,
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

      const keyboard = createGenderKeyboard(ctx, orderId);
      const message = `<b>${ctx.t('bot.configuration.gender')}:</b>`;

      await this.messageService.sendOrEditMessage(ctx, {
        text: message,
        parseMode: 'HTML',
        replyMarkup: keyboard,
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

      const keyboard = createTopicsKeyboard(ctx, orderId, order.config.excludedTopics);
      const message = `<b>${ctx.t('bot.configuration.excluded_topics')}</b>\n\n${ctx.t('bot.configuration.excluded_topics')}:`;

      await this.messageService.sendOrEditMessage(ctx, {
        text: message,
        parseMode: 'HTML',
        replyMarkup: keyboard,
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

      const keyboard = createLocationKeyboard(ctx, orderId);
      const message = `<b>${ctx.t('bot.configuration.display_locations')}</b>\n\n${ctx.t('bot.configuration.display_locations')}:`;

      await this.messageService.sendOrEditMessage(ctx, {
        text: message,
        parseMode: 'HTML',
        replyMarkup: keyboard,
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

  /**
   * Get available categories for selection (excluding 'all')
   */
  private getAvailableCategories(): Array<{ type: string; name: string }> {
    return Object.values(TopicCategory)
      .filter((cat) => cat !== TopicCategory.All)
      .map((cat) => ({ type: cat, name: cat }));
  }

  /**
   * Handle edit categories
   */
  private async handleEditCategories(ctx: BotContext, page = 0): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:edit:categories:(.+)$/);
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

      const categories = this.getAvailableCategories();
      const selectedCategories = order.config.allowedCategories || [];

      const keyboard = createOrderCategoryKeyboard(ctx, orderId, categories, selectedCategories, page);

      const selectedInfo =
        selectedCategories.length > 0
          ? ctx.t('orders.category.selected_count', { count: selectedCategories.length })
          : ctx.t('orders.category.all_allowed');

      const message = `${ctx.t('orders.category.title')}\n\n${ctx.t('orders.category.prompt')}\n\n${selectedInfo}`;

      await this.messageService.sendOrEditMessage(ctx, {
        text: message,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error editing categories', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle category toggle
   */
  private async handleCategoryToggle(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:cat:([^:]+):([^:]+)$/);
      const categoryType = match?.[1];
      const orderId = match?.[2];

      if (!categoryType || !orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      // Toggle category in allowed list
      const allowedCategories = [...(order.config.allowedCategories || [])];
      const index = allowedCategories.indexOf(categoryType);

      if (index === -1) {
        allowedCategories.push(categoryType);
      } else {
        allowedCategories.splice(index, 1);
      }

      await this.orderService.updateOrderConfig(orderId, {
        allowedCategories,
      });

      // Refresh the categories screen (preserve current page from session if available)
      const page = this.getCategoryPageFromSession(ctx) || 0;
      await this.showCategoryScreen(ctx, orderId, page);
    } catch (error) {
      this.logger.error('Error toggling category', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle category page navigation
   */
  private async handleCategoryPage(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:catpage:(\d+):([^:]+)$/);
      const page = parseInt(match?.[1] || '0', 10);
      const orderId = match?.[2];

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

      // Save page to session for state preservation
      this.saveCategoryPageToSession(ctx, page);

      await this.showCategoryScreen(ctx, orderId, page);
    } catch (error) {
      this.logger.error('Error navigating category page', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle select all categories (clear selection = all allowed)
   */
  private async handleCategorySelectAll(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:catall:([^:]+)$/);
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

      // Clear selection to allow all categories
      await this.orderService.updateOrderConfig(orderId, {
        allowedCategories: [],
      });

      const page = this.getCategoryPageFromSession(ctx) || 0;
      await this.showCategoryScreen(ctx, orderId, page);
      await ctx.answerCallbackQuery(ctx.t('orders.category.all_allowed'));
    } catch (error) {
      this.logger.error('Error selecting all categories', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle clear category selection
   */
  private async handleCategoryClear(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:catclear:([^:]+)$/);
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

      // Clear selection
      await this.orderService.updateOrderConfig(orderId, {
        allowedCategories: [],
      });

      const page = this.getCategoryPageFromSession(ctx) || 0;
      await this.showCategoryScreen(ctx, orderId, page);
    } catch (error) {
      this.logger.error('Error clearing categories', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle save categories
   */
  private async handleCategorySave(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:catsave:([^:]+)$/);
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

      // Clear category page from session
      this.clearCategoryPageFromSession(ctx);

      // Return to config screen
      await this.handleOrderConfig(ctx);
      await ctx.answerCallbackQuery(ctx.t('orders.category.saved'));
    } catch (error) {
      this.logger.error('Error saving categories', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Show category selection screen
   */
  private async showCategoryScreen(ctx: BotContext, orderId: string, page: number): Promise<void> {
    const order = await this.orderService.getOrderById(orderId);
    if (!order) {
      return;
    }

    const categories = this.getAvailableCategories();
    const selectedCategories = order.config.allowedCategories || [];

    const keyboard = createOrderCategoryKeyboard(ctx, orderId, categories, selectedCategories, page);

    const selectedInfo =
      selectedCategories.length > 0
        ? ctx.t('orders.category.selected_count', { count: selectedCategories.length })
        : ctx.t('orders.category.all_allowed');

    const message = `${ctx.t('orders.category.title')}\n\n${ctx.t('orders.category.prompt')}\n\n${selectedInfo}`;

    await this.messageService.sendOrEditMessage(ctx, {
      text: message,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });

    await ctx.answerCallbackQuery();
  }

  /**
   * Get category page from session
   */
  private getCategoryPageFromSession(ctx: BotContext): number | null {
    return (ctx.session?.formData?.categoryPage as number) || null;
  }

  /**
   * Save category page to session
   */
  private saveCategoryPageToSession(ctx: BotContext, page: number): void {
    if (!ctx.session) {
      ctx.session = {};
    }

    if (!ctx.session.formData) {
      ctx.session.formData = {};
    }

    ctx.session.formData.categoryPage = page;
  }

  /**
   * Clear category page from session
   */
  private clearCategoryPageFromSession(ctx: BotContext): void {
    if (ctx.session?.formData) {
      delete ctx.session.formData.categoryPage;
    }
  }
}
