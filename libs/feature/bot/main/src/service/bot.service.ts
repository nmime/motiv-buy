import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Bot, Context, Middleware, session, SessionFlavor } from 'grammy';
import { BotCommand, BotContext } from '@app/feature-bot-shared';
import { BotConfigService } from '../config';
import { getErrorMessage, unknownToError, toError } from '@app/common-shared';
import { OrderHandler } from '../features/order/order.handler';
import { I18nService } from 'nestjs-i18n';
import { createGrammyI18nMiddleware, I18nContextFlavor } from '@app/common-intl';
import { CallbackRouterHandler } from '../handler/callback-router.handler';
import { BotAuthMiddleware } from '../middleware';
import { BotUserService, BotSessionService } from './auth';
import { protectHandler } from '../util';

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
  ) {
    // Note: ProfileActionHandler, SettingsActionHandler, BalanceActionHandler, and MenuActionHandler
    // cannot be injected here because they depend on services that are not available in bot.service.ts scope.
    // These handlers are managed by CallbackRouterHandler which has proper access to all dependencies.
    // The command methods below will be refactored to use CallbackRouterHandler instead of manual instantiation.
  }

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
      const authMiddleware = BotAuthMiddleware.create(this.botUserService, this.botSessionService);
      // Cast to Grammy middleware type - required because our BotContext extends Context
      // but Grammy's type system doesn't automatically recognize this compatibility
      this.bot.use(authMiddleware as Middleware<BotSessionContext>);

      // Install error handling middleware
      this.bot.catch(async (err) => {
        const { ctx } = err;
        // Grammy's BotError.error is typed as unknown, convert to Error instance
        const error = toError(err.error);
        this.logger.error('Bot error occurred', {
          error: error.message,
          stack: error.stack,
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

    // Protected commands - require authentication
    this.bot.command(
      'profile',
      protectHandler(async (ctx) => {
        await this.processCommand(this.mapContextToBotContext(ctx), BotCommand.Profile);
      }),
    );

    this.bot.command(
      'settings',
      protectHandler(async (ctx) => {
        await this.processCommand(this.mapContextToBotContext(ctx), BotCommand.Settings);
      }),
    );

    this.bot.command(
      'balance',
      protectHandler(async (ctx) => {
        await this.processCommand(this.mapContextToBotContext(ctx), BotCommand.Balance);
      }),
    );

    this.bot.command(
      'menu',
      protectHandler(async (ctx) => {
        await this.processCommand(this.mapContextToBotContext(ctx), BotCommand.Menu);
      }),
    );
  }

  /**
   * Register callback query handlers
   */
  private registerCallbackHandlers(): void {
    if (!this.bot) {
      return;
    }

    // Protected callback handlers - require authentication
    this.bot.on(
      'callback_query:data',
      protectHandler(async (ctx) => {
        await this.callbackRouter.routeCallback(this.mapContextToBotContext(ctx));
      }),
    );
  }

  /**
   * Register feature handlers
   */
  private registerFeatureHandlers(): void {
    if (!this.bot) {
      return;
    }

    // Register Order feature handlers
    // Double cast required: Composer<BotContext> -> unknown -> Middleware<BotSessionContext>
    // BotContext and BotSessionContext are runtime-compatible but TypeScript can't verify this
    const orderComposer = this.orderHandler.getComposer();
    this.bot.use(orderComposer as unknown as Middleware<BotSessionContext>);

    this.logger.log('Feature handlers registered successfully');
  }

  /**
   * Map Grammy context to BotContext
   *
   * Transforms Grammy's BotSessionContext into our custom BotContext interface
   * This is safe because we're constructing an object that implements all required BotContext properties
   */
  private mapContextToBotContext(ctx: BotSessionContext): BotContext {
    // Construct BotContext-compatible object
    // We construct an object with all required properties and return it typed as BotContext
    // TypeScript satisfies operator would be ideal here but as is cleaner for this complex structure
    const botContext = {
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
    };

    // Safe cast: We've constructed an object with all BotContext properties
    // TypeScript can't infer this automatically due to the complex nested structure
    return botContext as BotContext;
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
    // Simulate callback query for profile:view action
    // This delegates to CallbackRouterHandler which has proper dependency injection
    const simulatedCallback = {
      ...ctx,
      callbackQuery: {
        id: 'cmd_profile',
        from: ctx.from!,
        data: 'profile:view',
        chat_instance: '',
      },
    };

    await this.callbackRouter.routeCallback(simulatedCallback as BotContext);
  }

  private async handleSettingsCommand(ctx: BotContext): Promise<void> {
    // Simulate callback query for settings:view action
    const simulatedCallback = {
      ...ctx,
      callbackQuery: {
        id: 'cmd_settings',
        from: ctx.from!,
        data: 'settings',
        chat_instance: '',
      },
    };

    await this.callbackRouter.routeCallback(simulatedCallback as BotContext);
  }

  private async handleBalanceCommand(ctx: BotContext): Promise<void> {
    // Simulate callback query for balance:view action
    const simulatedCallback = {
      ...ctx,
      callbackQuery: {
        id: 'cmd_balance',
        from: ctx.from!,
        data: 'balance:view',
        chat_instance: '',
      },
    };

    await this.callbackRouter.routeCallback(simulatedCallback as BotContext);
  }

  private async handleMenuCommand(ctx: BotContext): Promise<void> {
    // Simulate callback query for menu:main action
    const simulatedCallback = {
      ...ctx,
      callbackQuery: {
        id: 'cmd_menu',
        from: ctx.from!,
        data: 'menu:main',
        chat_instance: '',
      },
    };

    await this.callbackRouter.routeCallback(simulatedCallback as BotContext);
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
