/**
 * Order Handler (Main Composer)
 *
 * Composes all order-related handlers into a single Grammy composer.
 * This is the entry point for all order feature interactions.
 *
 * Handler Structure:
 * - OrderCreationHandler: Order creation flow (A2-A4)
 * - OrderManagementHandler: Viewing, toggling, deleting orders
 * - OrderConfigHandler: Configuration screens (A5)
 * - OrderEditHandler: Edit operations (text inputs)
 */

import { Injectable, Logger } from '@nestjs/common';
import { Composer, InlineKeyboard } from 'grammy';
import { BotContext } from '@app/feature-bot-shared';
import { BotOrderService } from './bot-order.service';
import { OrderCreationHandler } from './handlers/order.creation.handler';
import { OrderManagementHandler } from './handlers/order.management.handler';
import { OrderConfigHandler } from './handlers/order.config.handler';
import { OrderEditHandler } from './handlers/order.edit.handler';

@Injectable()
export class OrderHandler {
  private readonly logger = new Logger(OrderHandler.name);
  private composer: Composer<BotContext>;

  // Sub-handlers
  private creationHandler: OrderCreationHandler;
  private managementHandler: OrderManagementHandler;
  private configHandler: OrderConfigHandler;
  private editHandler: OrderEditHandler;

  constructor(private readonly orderService: BotOrderService) {
    // Initialize sub-handlers
    this.creationHandler = new OrderCreationHandler(orderService);
    this.managementHandler = new OrderManagementHandler(orderService);
    this.configHandler = new OrderConfigHandler(orderService);
    this.editHandler = new OrderEditHandler(orderService);

    // Create main composer
    this.composer = new Composer<BotContext>();
    this.setupHandlers();
  }

  /**
   * Get Grammy composer for use in bot service
   */
  getComposer(): Composer<BotContext> {
    return this.composer;
  }

  /**
   * Setup all handlers by composing sub-handlers
   */
  private setupHandlers(): void {
    // Main menu handler
    this.composer.callbackQuery('menu:main', (ctx) => this.handleMainMenu(ctx));

    // Register all sub-handlers
    this.composer.use(this.creationHandler.getComposer());
    this.composer.use(this.managementHandler.getComposer());
    this.composer.use(this.configHandler.getComposer());
    this.composer.use(this.editHandler.getComposer());

    // Help handlers
    this.composer.callbackQuery(/^order:help:/, (ctx) => this.handleHelp(ctx));

    // Integration/Transfer placeholders
    this.composer.callbackQuery('order:integration', (ctx) => this.handleIntegration(ctx));
    this.composer.callbackQuery('order:transfer', (ctx) => this.handleTransfer(ctx));

    // Download reports
    this.composer.callbackQuery(/^order:download:/, (ctx) => this.handleDownload(ctx));

    // No-op handler for pagination counters
    this.composer.callbackQuery('noop', (ctx) => ctx.answerCallbackQuery());

    this.logger.log('Order handler initialized with all sub-handlers');
  }

  /**
   * Handle main menu - uses centralized layout with translations
   * Row 1: Sell Traffic | Buy Traffic
   * Row 2: Profile | Balance
   * Row 3: Support
   */
  private async handleMainMenu(ctx: BotContext): Promise<void> {
    try {
      const message = ctx.t('menu.main_menu.select_action');
      const keyboard = new InlineKeyboard()
        .text(ctx.t('menu.main_menu.btn_sell_traffic'), 'menu:sell_traffic')
        .text(ctx.t('menu.main_menu.btn_buy_traffic'), 'menu:buy_traffic')
        .row()
        .text(ctx.t('menu.main_menu.btn_profile'), 'profile:view')
        .text(ctx.t('menu.main_menu.btn_balance'), 'balance:view')
        .row()
        .text(ctx.t('menu.main_menu.btn_support'), 'menu:support');

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error handling main menu', error);
      await ctx.answerCallbackQuery(ctx.t('common.errors.menu_load'));
    }
  }

  /**
   * Handle help requests
   */
  private async handleHelp(ctx: BotContext): Promise<void> {
    const callbackData = ctx.callbackQuery?.data || '';

    let helpMessage = '';

    if (callbackData.includes('invite_link')) {
      helpMessage = ctx.t('help.invite_link_why', {
        default:
          '<b>Why do I need an invite link?</b>\n\nAn invite link is needed so that new subscribers can join your channel/chat. Without it, ad display is not possible.',
      });
    } else if (callbackData.includes('create_invite')) {
      helpMessage = ctx.t('help.invite_link_how', {
        default:
          '<b>How to create an invite link?</b>\n\n1. Open your channel/chat settings\n2. Go to "Invite links" section\n3. Create a new link or copy an existing one\n4. Send the link to the bot',
      });
    } else if (callbackData.includes('troubleshoot')) {
      helpMessage = ctx.t('help.order_troubleshoot', {
        default:
          '<b>Why is my order not working?</b>\n\nPossible reasons:\n\n• Order is under moderation\n• Insufficient balance\n• Channel is blocked\n• Bot is not an admin\n• Price per subscriber is too low\n\nTry:\n1. Check your balance\n2. Increase the price\n3. Add the bot as admin\n4. Contact support',
      });
    } else {
      helpMessage = ctx.t('help.general', {
        default: '<b>Help</b>\n\nFor help, use the "Support" section in the main menu.',
      });
    }

    await ctx.answerCallbackQuery({
      text: helpMessage,
      show_alert: true,
    });
  }

  /**
   * Handle integration (API) placeholder
   */
  private async handleIntegration(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery(ctx.t('orders.integration_coming'));
  }

  /**
   * Handle bot transfer placeholder
   */
  private async handleTransfer(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery(ctx.t('orders.transfer_coming'));
  }

  /**
   * Handle download requests
   */
  private async handleDownload(ctx: BotContext): Promise<void> {
    const callbackData = ctx.callbackQuery?.data || '';

    if (callbackData.includes('ids')) {
      await ctx.answerCallbackQuery(ctx.t('orders.download_ids_coming'));
    } else if (callbackData.includes('report')) {
      await ctx.answerCallbackQuery(ctx.t('orders.download_pdf_coming'));
    } else if (callbackData.includes('excel')) {
      await ctx.answerCallbackQuery(ctx.t('orders.download_excel_coming'));
    } else {
      await ctx.answerCallbackQuery(ctx.t('orders.feature_coming'));
    }
  }
}
