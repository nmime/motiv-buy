import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Bot, Context, session, SessionFlavor } from 'grammy';
import { BotCommand, BotContext } from '@app/feature-bot-shared';
import { BotConfigService } from '../config';
import { unknownToError } from '@app/common-shared';
import { OrderHandler } from '../features/order/order.handler';
import { I18nService } from 'nestjs-i18n';
import { createGrammyI18nMiddleware, I18nContextFlavor } from '@app/common-intl';
import { CallbackRouterHandler } from '../handler/callback-router.handler';
import { BotAuthMiddleware } from '../middleware';
import { BotUserService, BotSessionService } from './auth';

/**
 * Extended Grammy Context with session and i18n support
 */
interface BotSessionContext extends Context, SessionFlavor<Record<string, unknown>>, I18nContextFlavor {
  userId?: string;
  isAuthenticated?: boolean;
  userData?: {
    id: string;
    firstName: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
  };
}

/**
 * Bot Service
 *
 * Core service for handling Telegram bot orchestration and coordination.
 * Manages bot lifecycle, message routing, and high-level bot operations.
 * Integrates with Grammy framework for Telegram Bot API interactions.
 *
 * @class BotService
 */
@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private bot: Bot<BotSessionContext> | null = null;
  private isRunning = false;

  constructor(
    private readonly botConfigService: BotConfigService,
    private readonly orderHandler: OrderHandler,
    private readonly i18n: I18nService,
    private readonly callbackRouter: CallbackRouterHandler,
    private readonly botUserService: BotUserService,
    private readonly botSessionService: BotSessionService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }

  /**
   * Initialize bot service with Grammy bot instance
   *
   * @returns Promise<void>
   */
  async initialize(): Promise<void> {
    try {
      this.logger.log('Initializing Telegram bot service...');

      const botToken = this.botConfigService.getBotToken();
      if (!botToken) {
        throw new Error(this.i18n.t('common.errors.bot_token_not_configured'));
      }

      // Create Grammy bot instance
      this.bot = new Bot<BotSessionContext>(botToken);

      // Install session middleware
      this.bot.use(
        session({
          initial: () => ({}),
        }),
      );

      // Install i18n middleware for translations
      this.bot.use(createGrammyI18nMiddleware(this.i18n));

      // Install authentication middleware
      // This middleware loads user from database and adds to context
      // Type assertion needed due to context type compatibility
      this.bot.use(BotAuthMiddleware.create(this.botUserService, this.botSessionService) as any);

      // Install error handling middleware
      this.bot.catch(async (err) => {
        const { ctx } = err;
        const error = err.error as Error;
        this.logger.error('Bot error occurred', {
          error: error.message,
          stack: err.stack,
          userId: ctx.userId,
          messageText: ctx.message?.text,
        });

        await this.handleError(error, this.mapContextToBotContext(ctx));
      });

      // Register command handlers
      this.registerCommandHandlers();

      // Register callback query handlers
      this.registerCallbackHandlers();

      // Register feature handlers (Order feature)
      this.registerFeatureHandlers();

      this.logger.log('Bot service initialized successfully');
    } catch (err: unknown) {
      this.logger.error('Failed to initialize bot service', {
        error: unknownToError(err),
      });

      throw err;
    }
  }

  /**
   * Start the bot polling
   *
   * @returns Promise<void>
   */
  async start(): Promise<void> {
    if (!this.bot) {
      throw new Error(this.i18n.t('common.errors.bot_not_initialized'));
    }

    if (this.isRunning) {
      this.logger.warn('Bot is already running');

      return;
    }

    try {
      this.logger.log('Starting bot polling...');
      this.isRunning = true;
      await this.bot.start();
      this.logger.log('Bot started successfully');
    } catch (err: unknown) {
      this.isRunning = false;
      this.logger.error('Failed to start bot', {
        error: unknownToError(err),
      });

      throw err;
    }
  }

  /**
   * Stop the bot polling
   *
   * @returns Promise<void>
   */
  async stop(): Promise<void> {
    if (!this.bot || !this.isRunning) {
      return;
    }

    try {
      this.logger.log('Stopping bot...');
      await this.bot.stop();
      this.isRunning = false;
      this.logger.log('Bot stopped successfully');
    } catch (err: unknown) {
      this.logger.error('Failed to stop bot', {
        error: unknownToError(err),
      });
    }
  }

  /**
   * Command handler map for O(1) lookup performance
   * Using Partial to allow incomplete mapping of all commands
   */
  private readonly commandHandlers: Partial<Record<BotCommand, (ctx: BotContext) => Promise<void>>> = {
    [BotCommand.Start]: (ctx) => this.handleStartCommand(ctx),
    [BotCommand.Help]: (ctx) => this.handleHelpCommand(ctx),
    [BotCommand.Profile]: (ctx) => this.handleProfileCommand(ctx),
    [BotCommand.Settings]: (ctx) => this.handleSettingsCommand(ctx),
    [BotCommand.Balance]: (ctx) => this.handleBalanceCommand(ctx),
    [BotCommand.Menu]: (ctx) => this.handleMenuCommand(ctx),
  };

  /**
   * Process incoming bot command
   *
   * @param ctx - Bot context containing message and user information
   * @param command - Command type to process
   * @returns Promise<void>
   */
  async processCommand(ctx: BotContext, command: BotCommand): Promise<void> {
    try {
      this.logger.debug(`Processing command: ${command}`, {
        userId: ctx.from?.id,
        command,
      });

      // Ensure user is authenticated for most commands
      if (!ctx.from && command !== BotCommand.Start) {
        await this.sendAuthenticationRequired(ctx);

        return;
      }

      // Get handler from map
      const handler = this.commandHandlers[command];

      if (handler) {
        await handler(ctx);
      } else {
        await this.handleUnknownCommand(ctx);
      }
    } catch (err: unknown) {
      this.logger.error('Error processing command', {
        command,
        error: unknownToError(err),
        userId: ctx.from?.id,
      });

      await this.handleError(err as Error, ctx);
    }
  }

  /**
   * Handle bot error scenarios
   *
   * @param error - Error object
   * @param ctx - Bot context where error occurred
   * @returns Promise<void>
   */
  async handleError(error: Error, ctx?: BotContext): Promise<void> {
    try {
      this.logger.error('Bot error occurred', {
        error: error.message,
        stack: error.stack,
        userId: ctx?.from?.id,
      });

      if (ctx?.reply) {
        const errorMessage = this.botConfigService.isDevelopment()
          ? `Error: ${error.message}`
          : 'Sorry, something went wrong. Please try again later.';

        await ctx.reply(errorMessage);
      }
    } catch (replyError) {
      this.logger.error('Failed to send error message', {
        originalError: error.message,
        replyError: replyError instanceof Error ? replyError.message : String(replyError),
      });
    }
  }

  /**
   * Shutdown bot service gracefully
   *
   * @returns Promise<void>
   */
  async shutdown(): Promise<void> {
    this.logger.log('Shutting down bot service...');
    await this.stop();
    this.bot = null;
    this.logger.log('Bot service shutdown completed');
  }

  /**
   * Register command handlers
   */
  private registerCommandHandlers(): void {
    if (!this.bot) {
      return;
    }

    this.bot.command('start', async (ctx) => {
      await this.processCommand(this.mapContextToBotContext(ctx), BotCommand.Start);
    });

    this.bot.command('help', async (ctx) => {
      await this.processCommand(this.mapContextToBotContext(ctx), BotCommand.Help);
    });

    this.bot.command('profile', async (ctx) => {
      await this.processCommand(this.mapContextToBotContext(ctx), BotCommand.Profile);
    });

    this.bot.command('settings', async (ctx) => {
      await this.processCommand(this.mapContextToBotContext(ctx), BotCommand.Settings);
    });

    this.bot.command('balance', async (ctx) => {
      await this.processCommand(this.mapContextToBotContext(ctx), BotCommand.Balance);
    });

    this.bot.command('menu', async (ctx) => {
      await this.processCommand(this.mapContextToBotContext(ctx), BotCommand.Menu);
    });
  }

  /**
   * Register callback query handlers
   */
  private registerCallbackHandlers(): void {
    if (!this.bot) {
      return;
    }

    this.bot.on('callback_query:data', async (ctx) => {
      await this.callbackRouter.routeCallback(this.mapContextToBotContext(ctx));
    });
  }

  /**
   * Register feature handlers
   */
  private registerFeatureHandlers(): void {
    if (!this.bot) {
      return;
    }

    // Register Order feature handlers
    // Type assertion needed due to context compatibility
    this.bot.use(this.orderHandler.getComposer() as any);

    this.logger.log('Feature handlers registered successfully');
  }

  /**
   * Map Grammy context to BotContext
   */
  private mapContextToBotContext(ctx: BotSessionContext): BotContext {
    return {
      message: ctx.message
        ? {
            message_id: ctx.message.message_id,
            text: ctx.message.text,
            from: ctx.message.from
              ? {
                  id: ctx.message.from.id,
                  is_bot: ctx.message.from.is_bot,
                  first_name: ctx.message.from.first_name,
                  last_name: ctx.message.from.last_name,
                  username: ctx.message.from.username,
                  language_code: ctx.message.from.language_code,
                }
              : undefined,
            chat: {
              id: ctx.message.chat.id,
              type: ctx.message.chat.type as 'private' | 'group' | 'supergroup' | 'channel',
              title: ctx.message.chat.title,
              username: ctx.message.chat.username,
              first_name: ctx.message.chat.first_name,
              last_name: ctx.message.chat.last_name,
            },
            date: ctx.message.date,
          }
        : undefined,
      callbackQuery: ctx.callbackQuery
        ? {
            id: ctx.callbackQuery.id,
            from: {
              id: ctx.callbackQuery.from.id,
              is_bot: ctx.callbackQuery.from.is_bot,
              first_name: ctx.callbackQuery.from.first_name,
              last_name: ctx.callbackQuery.from.last_name,
              username: ctx.callbackQuery.from.username,
              language_code: ctx.callbackQuery.from.language_code,
            },
            message: ctx.callbackQuery.message
              ? {
                  message_id: ctx.callbackQuery.message.message_id,
                  chat: {
                    id: ctx.callbackQuery.message.chat.id,
                    type: ctx.callbackQuery.message.chat.type as 'private' | 'group' | 'supergroup' | 'channel',
                    title: ctx.callbackQuery.message.chat.title,
                    username: ctx.callbackQuery.message.chat.username,
                    first_name: ctx.callbackQuery.message.chat.first_name,
                    last_name: ctx.callbackQuery.message.chat.last_name,
                  },
                  date: ctx.callbackQuery.message.date,
                }
              : undefined,
            data: ctx.callbackQuery.data,
          }
        : undefined,
      from: ctx.from
        ? {
            id: ctx.from.id,
            is_bot: ctx.from.is_bot,
            first_name: ctx.from.first_name,
            last_name: ctx.from.last_name,
            username: ctx.from.username,
            language_code: ctx.from.language_code,
          }
        : undefined,
      chat: ctx.chat
        ? {
            id: ctx.chat.id,
            type: ctx.chat.type as 'private' | 'group' | 'supergroup' | 'channel',
            title: ctx.chat.title,
            username: ctx.chat.username,
            first_name: ctx.chat.first_name,
            last_name: ctx.chat.last_name,
          }
        : undefined,
      reply: async (text: string, extra?: Record<string, unknown>) => {
        return await ctx.reply(text, extra);
      },
      replyWithMarkdown: async (text: string, extra?: Record<string, unknown>) => {
        return await ctx.reply(text, { parse_mode: 'Markdown', ...extra });
      },
      replyWithHTML: async (text: string, extra?: Record<string, unknown>) => {
        return await ctx.reply(text, { parse_mode: 'HTML', ...extra });
      },
      editMessageText: async (text: string, extra?: Record<string, unknown>) => {
        return await ctx.editMessageText(text, extra);
      },
      answerCallbackQuery: async (text?: string, extra?: Record<string, unknown>) => {
        if (extra && Object.keys(extra).length > 0) {
          return await ctx.answerCallbackQuery({ text, ...extra });
        }

        return await ctx.answerCallbackQuery(text);
      },
      api: ctx.api,
      session: ctx.session,
      state: ctx.userData,
      language: ctx.language,
      t: ctx.t,
    } as unknown as BotContext;
  }

  // Command handlers
  private async handleStartCommand(ctx: BotContext): Promise<void> {
    // Import main menu from order feature
    const message = `Выбери нужный пункт 👇`;

    await ctx.replyWithHTML(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '👥 Купить подписчиков', callback_data: 'order:list' }],
          [
            { text: '🤖 Продажа трафика', callback_data: 'traffic:manage' },
            { text: '📋 Мои заказы', callback_data: 'order:list' },
          ],
          [
            { text: '👤 Профиль', callback_data: 'profile:view' },
            { text: '💰 Баланс', callback_data: 'balance:view' },
          ],
          [{ text: '🏢 Тех. поддержка', callback_data: 'support:contact' }],
        ],
      },
    });
  }

  private async handleHelpCommand(ctx: BotContext): Promise<void> {
    const helpText = `
🤖 **MotivBuy Bot Help**

**Available Commands:**
/start - Start or restart the bot
/menu - Open main menu
/profile - View your profile
/balance - Check your balance
/settings - Manage settings
/help - Show this help message

**Features:**
• 📊 Track your campaign performance
• 💰 Monitor earnings and balance
• 🎯 Manage traffic sources
• ⚙️ Customize preferences
• 📈 View detailed statistics

For support, contact @support or use the /support command.
`;

    await ctx.replyWithMarkdown(helpText);
  }

  private async handleProfileCommand(ctx: BotContext): Promise<void> {
    const { ProfileActionHandler } = require('../handler/profile-action.handler');
    const { MenuActionHandler } = require('../handler/menu-action.handler');
    const menuHandler = new MenuActionHandler();
    const profileHandler = new ProfileActionHandler(null as any, menuHandler);
    await profileHandler.handleProfileView(ctx);
  }

  private async handleSettingsCommand(ctx: BotContext): Promise<void> {
    const { SettingsActionHandler } = require('../handler/settings-action.handler');
    const { MenuActionHandler } = require('../handler/menu-action.handler');
    const menuHandler = new MenuActionHandler();
    const settingsHandler = new SettingsActionHandler(null as any, menuHandler);
    await settingsHandler.handleSettingsView(ctx);
  }

  private async handleBalanceCommand(ctx: BotContext): Promise<void> {
    const { BalanceActionHandler } = require('../handler/balance-action.handler');
    const { MenuActionHandler } = require('../handler/menu-action.handler');
    const menuHandler = new MenuActionHandler();
    const balanceHandler = new BalanceActionHandler(null as any, menuHandler);
    await balanceHandler.handleBalanceView(ctx);
  }

  private async handleMenuCommand(ctx: BotContext): Promise<void> {
    const { MenuActionHandler } = require('../handler/menu-action.handler');
    const menuHandler = new MenuActionHandler();
    const keyboard = menuHandler.createMainMenuKeyboard();
    await ctx.reply('📋 <b>Main Menu</b>\n\nSelect an option below:', {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  private async handleUnknownCommand(ctx: BotContext): Promise<void> {
    await ctx.reply(
      "I don't understand that command. 🤔\n\n" + 'Use /help to see available commands or /menu for the main menu.',
    );
  }

  private async sendAuthenticationRequired(ctx: BotContext): Promise<void> {
    await ctx.reply('Please authenticate first by using the /start command.');
  }
}
