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
  createAgeKeyboard,
  createAudienceConfigKeyboard,
  createConfigurationKeyboard,
  createGenderKeyboard,
  createLocationKeyboard,
  createOrderCategoryKeyboard,
  createOrderLanguageKeyboard,
  createRegionKeyboard,
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

    // Age configuration
    this.composer.callbackQuery(/^order:audience:age:([^:]+)$/, (ctx) => this.handleAudienceAge(ctx));
    this.composer.callbackQuery(/^order:age:min:(\d+):([^:]+)$/, (ctx) => this.handleAgeMinSelection(ctx));
    this.composer.callbackQuery(/^order:age:max:(\d+):([^:]+)$/, (ctx) => this.handleAgeMaxSelection(ctx));
    this.composer.callbackQuery(/^order:age:clear:([^:]+)$/, (ctx) => this.handleAgeClear(ctx));

    // Region configuration
    this.composer.callbackQuery(/^order:audience:region:([^:]+)$/, (ctx) => this.handleAudienceRegion(ctx));
    this.composer.callbackQuery(/^order:region:toggle:([^:]+):([^:]+)$/, (ctx) => this.handleRegionToggle(ctx));
    this.composer.callbackQuery(/^order:region:page:(\d+):([^:]+)$/, (ctx) => this.handleRegionPage(ctx));
    this.composer.callbackQuery(/^order:region:clear:([^:]+)$/, (ctx) => this.handleRegionClear(ctx));
    this.composer.callbackQuery(/^order:region:save:([^:]+)$/, (ctx) => this.handleRegionSave(ctx));

    // Language configuration
    this.composer.callbackQuery(/^order:audience:language:([^:]+)$/, (ctx) => this.handleAudienceLanguage(ctx));
    this.composer.callbackQuery(/^order:language:toggle:([^:]+):([^:]+)$/, (ctx) => this.handleLanguageToggle(ctx));
    this.composer.callbackQuery(/^order:language:page:(\d+):([^:]+)$/, (ctx) => this.handleLanguagePage(ctx));
    this.composer.callbackQuery(/^order:language:clear:([^:]+)$/, (ctx) => this.handleLanguageClear(ctx));
    this.composer.callbackQuery(/^order:language:save:([^:]+)$/, (ctx) => this.handleLanguageSave(ctx));

    // Audience save (back to config)
    this.composer.callbackQuery(/^order:audience:save:([^:]+)$/, (ctx) => this.handleAudienceSave(ctx));

    // Topics configuration

    this.composer.callbackQuery(/^order:edit:topics:([^:]+)$/, (ctx) => this.handleEditTopics(ctx));
    this.composer.callbackQuery(/^order:topic:([^:]+):([^:]+)$/, (ctx) => this.handleTopicToggle(ctx));
    this.composer.callbackQuery(/^order:topics:save:([^:]+)$/, (ctx) => this.handleTopicsSave(ctx));

    // Categories configuration
    this.composer.callbackQuery(/^order:edit:categories:([^:]+)$/, (ctx) => this.handleEditCategories(ctx));
    this.composer.callbackQuery(/^order:cat:([^:]+):([^:]+)$/, (ctx) => this.handleCategoryToggle(ctx));
    this.composer.callbackQuery(/^order:catpage:(\d+):([^:]+)$/, (ctx) => this.handleCategoryPage(ctx));
    this.composer.callbackQuery(/^order:catselectall:([^:]+)$/, (ctx) => this.handleCategorySelectAll(ctx));
    this.composer.callbackQuery(/^order:catdeselectall:([^:]+)$/, (ctx) => this.handleCategoryDeselectAll(ctx));
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
   * Handle audience age selection menu
   */
  private async handleAudienceAge(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:audience:age:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      const ageRange = order.config.targetAudience?.ageRange;
      const keyboard = createAgeKeyboard(ctx, orderId, ageRange);

      let message = `<b>${ctx.t('orders.age.title')}</b>\n\n`;
      message += `${ctx.t('orders.age.prompt')}\n\n`;

      if (ageRange) {
        message += `${ctx.t('orders.age.current', { min: ageRange.min, max: ageRange.max })}`;
      } else {
        message += ctx.t('orders.age.any');
      }

      await this.messageService.sendOrEditMessage(ctx, {
        text: message,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error showing age selection', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle minimum age selection
   */
  private async handleAgeMinSelection(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:age:min:(\d+):([^:]+)$/);
      const minAgeStr = match?.[1];
      const orderId = match?.[2];

      if (!minAgeStr || !orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      const minAge = parseInt(minAgeStr, 10);

      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      const currentMax = order.config.targetAudience?.ageRange?.max ?? 99;
      const newMax = minAge > currentMax ? minAge + 10 : currentMax;

      await this.orderService.updateOrderConfig(orderId, {
        targetAudience: {
          ...order.config.targetAudience,
          ageRange: { min: minAge, max: newMax },
        },
      });

      await this.handleAudienceAge(ctx);
      await ctx.answerCallbackQuery(ctx.t('common.success.saved'));
    } catch (error) {
      this.logger.error('Error saving min age', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle maximum age selection
   */
  private async handleAgeMaxSelection(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:age:max:(\d+):([^:]+)$/);
      const maxAgeStr = match?.[1];
      const orderId = match?.[2];

      if (!maxAgeStr || !orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      const maxAge = parseInt(maxAgeStr, 10);

      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      const currentMin = order.config.targetAudience?.ageRange?.min ?? 13;
      const newMin = maxAge < currentMin ? maxAge - 10 : currentMin;

      await this.orderService.updateOrderConfig(orderId, {
        targetAudience: {
          ...order.config.targetAudience,
          ageRange: { min: Math.max(13, newMin), max: maxAge },
        },
      });

      await this.handleAudienceAge(ctx);
      await ctx.answerCallbackQuery(ctx.t('common.success.saved'));
    } catch (error) {
      this.logger.error('Error saving max age', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle clear age restriction (any age)
   */
  private async handleAgeClear(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:age:clear:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      await this.orderService.updateOrderConfig(orderId, {
        targetAudience: {
          ...order.config.targetAudience,
          ageRange: undefined,
        },
      });

      await this.handleAudienceAge(ctx);
      await ctx.answerCallbackQuery(ctx.t('common.success.saved'));
    } catch (error) {
      this.logger.error('Error clearing age restriction', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle audience region selection menu
   */
  private async handleAudienceRegion(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:audience:region:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      const regions = order.config.targetAudience?.regions ?? [];
      const page = this.getRegionPageFromSession(ctx) ?? 1;
      const keyboard = createRegionKeyboard(ctx, orderId, regions, page);

      let message = `<b>${ctx.t('orders.region.title')}</b>\n\n`;
      message += `${ctx.t('orders.region.prompt')}\n\n`;

      if (regions.length > 0) {
        message += ctx.t('orders.region.selected_count', { count: regions.length });
      } else {
        message += ctx.t('orders.region.all_allowed');
      }

      await this.messageService.sendOrEditMessage(ctx, {
        text: message,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error showing region selection', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle region toggle
   */
  private async handleRegionToggle(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:region:toggle:([^:]+):([^:]+)$/);
      const regionCode = match?.[1];
      const orderId = match?.[2];

      if (!regionCode || !orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      const regions = [...(order.config.targetAudience?.regions ?? [])];
      const index = regions.indexOf(regionCode);

      if (index === -1) {
        regions.push(regionCode);
      } else {
        regions.splice(index, 1);
      }

      await this.orderService.updateOrderConfig(orderId, {
        targetAudience: {
          ...order.config.targetAudience,
          regions,
        },
      });

      await this.handleAudienceRegion(ctx);
    } catch (error) {
      this.logger.error('Error toggling region', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle region page navigation
   */
  private async handleRegionPage(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:region:page:(\d+):([^:]+)$/);
      const pageStr = match?.[1];
      const orderId = match?.[2];

      if (!pageStr || !orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      const page = parseInt(pageStr, 10);
      this.saveRegionPageToSession(ctx, page);

      await this.handleAudienceRegion(ctx);
    } catch (error) {
      this.logger.error('Error navigating region page', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle region clear (all regions)
   */
  private async handleRegionClear(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:region:clear:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      await this.orderService.updateOrderConfig(orderId, {
        targetAudience: {
          ...order.config.targetAudience,
          regions: [],
        },
      });

      await this.handleAudienceRegion(ctx);
      await ctx.answerCallbackQuery(ctx.t('common.success.saved'));
    } catch (error) {
      this.logger.error('Error clearing regions', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle region save (back to audience menu)
   */
  private async handleRegionSave(ctx: BotContext): Promise<void> {
    try {
      this.clearRegionPageFromSession(ctx);
      await this.handleEditAudience(ctx);
      await ctx.answerCallbackQuery(ctx.t('common.success.saved'));
    } catch (error) {
      this.logger.error('Error saving regions', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle audience language selection menu
   */
  private async handleAudienceLanguage(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:audience:language:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      const languages = order.config.targetAudience?.languages ?? [];
      const page = this.getLanguagePageFromSession(ctx) ?? 1;
      const keyboard = createOrderLanguageKeyboard(ctx, orderId, languages, page);

      let message = `<b>${ctx.t('orders.language.title')}</b>\n\n`;
      message += `${ctx.t('orders.language.prompt')}\n\n`;

      if (languages.length > 0) {
        message += ctx.t('orders.language.selected_count', { count: languages.length });
      } else {
        message += ctx.t('orders.language.all_allowed');
      }

      await this.messageService.sendOrEditMessage(ctx, {
        text: message,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error showing language selection', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle language toggle
   */
  private async handleLanguageToggle(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:language:toggle:([^:]+):([^:]+)$/);
      const languageCode = match?.[1];
      const orderId = match?.[2];

      if (!languageCode || !orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      const languages = [...(order.config.targetAudience?.languages ?? [])];
      const index = languages.indexOf(languageCode);

      if (index === -1) {
        languages.push(languageCode);
      } else {
        languages.splice(index, 1);
      }

      await this.orderService.updateOrderConfig(orderId, {
        targetAudience: {
          ...order.config.targetAudience,
          languages,
        },
      });

      await this.handleAudienceLanguage(ctx);
    } catch (error) {
      this.logger.error('Error toggling language', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle language page navigation
   */
  private async handleLanguagePage(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:language:page:(\d+):([^:]+)$/);
      const pageStr = match?.[1];
      const orderId = match?.[2];

      if (!pageStr || !orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      const page = parseInt(pageStr, 10);
      this.saveLanguagePageToSession(ctx, page);

      await this.handleAudienceLanguage(ctx);
    } catch (error) {
      this.logger.error('Error navigating language page', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle language clear (all languages)
   */
  private async handleLanguageClear(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:language:clear:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      await this.orderService.updateOrderConfig(orderId, {
        targetAudience: {
          ...order.config.targetAudience,
          languages: [],
        },
      });

      await this.handleAudienceLanguage(ctx);
      await ctx.answerCallbackQuery(ctx.t('common.success.saved'));
    } catch (error) {
      this.logger.error('Error clearing languages', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle language save (back to audience menu)
   */
  private async handleLanguageSave(ctx: BotContext): Promise<void> {
    try {
      this.clearLanguagePageFromSession(ctx);
      await this.handleEditAudience(ctx);
      await ctx.answerCallbackQuery(ctx.t('common.success.saved'));
    } catch (error) {
      this.logger.error('Error saving languages', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Get language page from session
   */
  private getLanguagePageFromSession(ctx: BotContext): number | null {
    const page = ctx.session?.formData?.languagePage;

    return typeof page === 'number' ? page : null;
  }

  /**
   * Save language page to session
   */
  private saveLanguagePageToSession(ctx: BotContext, page: number): void {
    if (!ctx.session) {
      ctx.session = {};
    }

    if (!ctx.session.formData) {
      ctx.session.formData = {};
    }

    ctx.session.formData.languagePage = page;
  }

  /**
   * Clear language page from session
   */
  private clearLanguagePageFromSession(ctx: BotContext): void {
    if (ctx.session?.formData) {
      delete ctx.session.formData.languagePage;
    }
  }

  /**
   * Handle audience save (back to config)
   */
  private async handleAudienceSave(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:audience:save:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      await this.handleOrderConfig(ctx);
      await ctx.answerCallbackQuery(ctx.t('common.success.saved'));
    } catch (error) {
      this.logger.error('Error saving audience', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Get region page from session
   */
  private getRegionPageFromSession(ctx: BotContext): number | null {
    const page = ctx.session?.formData?.regionPage;

    return typeof page === 'number' ? page : null;
  }

  /**
   * Save region page to session
   */
  private saveRegionPageToSession(ctx: BotContext, page: number): void {
    if (!ctx.session) {
      ctx.session = {};
    }

    if (!ctx.session.formData) {
      ctx.session.formData = {};
    }

    ctx.session.formData.regionPage = page;
  }

  /**
   * Clear region page from session
   */
  private clearRegionPageFromSession(ctx: BotContext): void {
    if (ctx.session?.formData) {
      delete ctx.session.formData.regionPage;
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
   * Handle select all categories
   */
  private async handleCategorySelectAll(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:catselectall:([^:]+)$/);
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

      // Select all categories
      const allCategories = this.getAvailableCategories().map((cat) => cat.type);
      await this.orderService.updateOrderConfig(orderId, {
        allowedCategories: allCategories,
      });

      const page = this.getCategoryPageFromSession(ctx) || 0;
      await this.showCategoryScreen(ctx, orderId, page);
    } catch (error) {
      this.logger.error('Error selecting all categories', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle deselect all categories (clear selection = all allowed)
   */
  private async handleCategoryDeselectAll(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:catdeselectall:([^:]+)$/);
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

      // Clear selection (empty = all categories allowed)
      await this.orderService.updateOrderConfig(orderId, {
        allowedCategories: [],
      });

      const page = this.getCategoryPageFromSession(ctx) || 0;
      await this.showCategoryScreen(ctx, orderId, page);
      await ctx.answerCallbackQuery(ctx.t('orders.category.all_allowed'));
    } catch (error) {
      this.logger.error('Error deselecting categories', error);
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
    const page = ctx.session?.formData?.categoryPage;

    return typeof page === 'number' ? page : null;
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
