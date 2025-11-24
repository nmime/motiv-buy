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
import { Composer } from 'grammy';
import { BotContext } from '@app/feature-bot-shared';
import { BotOrderService } from './bot-order.service';
import { OrderCreationHandler } from './handlers/order.creation.handler';
import { OrderManagementHandler } from './handlers/order.management.handler';
import { OrderConfigHandler } from './handlers/order.config.handler';
import { OrderEditHandler } from './handlers/order.edit.handler';
import { createMainMenuKeyboard } from './order.keyboards';

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
   * Handle main menu
   */
  private async handleMainMenu(ctx: BotContext): Promise<void> {
    try {
      const message = 'Выбери нужный пункт 👇';
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
   * Handle help requests
   */
  private async handleHelp(ctx: BotContext): Promise<void> {
    const callbackData = ctx.callbackQuery?.data || '';

    let helpMessage = '';

    if (callbackData.includes('invite_link')) {
      helpMessage = `<b>Зачем нужна пригласительная ссылка?</b>\n\nПригласительная ссылка нужна для того, чтобы новые подписчики могли вступить в ваш канал/чат. Без неё показ рекламы невозможен.`;
    } else if (callbackData.includes('create_invite')) {
      helpMessage = `<b>Как создать пригласительную ссылку?</b>\n\n1. Откройте настройки вашего канала/чата\n2. Перейдите в раздел "Ссылки для приглашения"\n3. Создайте новую ссылку или скопируйте существующую\n4. Отправьте ссылку боту`;
    } else if (callbackData.includes('troubleshoot')) {
      helpMessage = `<b>Почему заказ не работает?</b>\n\nВозможные причины:\n\n• Заказ на модерации\n• Недостаточно средств на балансе\n• Канал заблокирован\n• Бот не является администратором\n• Низкая цена за подписчика\n\nПопробуйте:\n1. Проверить баланс\n2. Увеличить цену\n3. Добавить бота в админы\n4. Обратиться в поддержку`;
    } else {
      helpMessage = `<b>Помощь</b>\n\nДля получения помощи используйте раздел "Тех. поддержка" в главном меню.`;
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
    await ctx.answerCallbackQuery('💻 Интеграция API в разработке');
  }

  /**
   * Handle bot transfer placeholder
   */
  private async handleTransfer(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('🔄 Передача бота в разработке');
  }

  /**
   * Handle download requests
   */
  private async handleDownload(ctx: BotContext): Promise<void> {
    const callbackData = ctx.callbackQuery?.data || '';

    if (callbackData.includes('ids')) {
      await ctx.answerCallbackQuery('💾 Скачивание ID участников в разработке');
    } else if (callbackData.includes('report')) {
      await ctx.answerCallbackQuery('📄 Генерация PDF отчета в разработке');
    } else if (callbackData.includes('excel')) {
      await ctx.answerCallbackQuery('📥 Экспорт в Excel в разработке');
    } else {
      await ctx.answerCallbackQuery('📥 Функция в разработке');
    }
  }
}
