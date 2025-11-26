import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Bot, Context, Middleware, session, SessionFlavor } from 'grammy';
import { RedisAdapter } from '@grammyjs/storage-redis';
import type { Update } from 'grammy/types';
import type { Redis, Cluster } from 'ioredis';
import { BotCommand, BotContext, TelegramModerationNotifier } from '@app/feature-bot-shared';
import { BotConfigService } from '../config';
import { unknownToError, toError } from '@app/common-shared';
import { OrderHandler } from '../handler/order';
import { I18nService } from 'nestjs-i18n';
import { createGrammyI18nMiddleware, I18nContextFlavor } from '@app/common-intl';
import { CallbackRouterHandler } from '../handler/callback-router.handler';
import { BotAuthMiddleware } from '../middleware';
import { BotUserService, BotSessionService } from './auth';
import { protectHandler } from '../util';
import { RedisInjectToken } from '@app/common-redis';

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
  private webhookMode = false;

  constructor(
    private readonly botConfigService: BotConfigService,
    private readonly orderHandler: OrderHandler,
    private readonly i18n: I18nService,
    private readonly callbackRouter: CallbackRouterHandler,
    private readonly botUserService: BotUserService,
    private readonly botSessionService: BotSessionService,
    private readonly telegramModerationNotifier: TelegramModerationNotifier,
    @Inject(RedisInjectToken) private readonly redis: Redis | Cluster,
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
   * Get the bot instance
   * Used by services that need to interact with Telegram Bot API directly
   *
   * @returns Bot instance (may be null if not initialized)
   */
  getBot(): Bot<BotSessionContext> | null {
    return this.bot;
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

      // Create Grammy bot instance with client configuration
      const pollingConfig = this.botConfigService.getBotConfig().polling;
      this.bot = new Bot<BotSessionContext>(botToken, {
        client: {
          timeoutSeconds: pollingConfig?.timeout || 30,
        },
      });

      // Install session middleware with Redis storage for persistence
      // Type assertion required: ioredis types are compatible but @grammyjs/storage-redis
      // uses a slightly different type definition. Runtime compatibility verified.
      const storage = new RedisAdapter({ instance: this.redis as Redis });
      this.bot.use(
        session({
          initial: () => ({}),
          storage,
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

      // Inject bot instance into TelegramModerationNotifier
      this.telegramModerationNotifier.setBot(this.bot);

      this.logger.log('Bot service initialized successfully');
    } catch (err: unknown) {
      this.logger.error('Failed to initialize bot service', {
        error: unknownToError(err),
      });

      throw err;
    }
  }

  /**
   * Start the bot in appropriate mode (webhook or polling)
   * Automatically detects mode based on BOT_WEBHOOK_URL configuration
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
      const webhookConfig = this.botConfigService.getBotConfig().webhook;

      // Decide mode based on webhook URL configuration
      if (webhookConfig && webhookConfig.url) {
        // Webhook mode - for production
        await this.startWebhook(webhookConfig);
      } else {
        // Polling mode - for development
        await this.startPolling();
      }
    } catch (err: unknown) {
      this.isRunning = false;
      this.logger.error('Failed to start bot', {
        error: unknownToError(err),
      });

      throw err;
    }
  }

  /**
   * Start bot in polling mode (development)
   *
   * @returns Promise<void>
   */
  private async startPolling(): Promise<void> {
    if (!this.bot) {
      throw new Error('Bot not initialized');
    }

    this.logger.log('Starting bot in polling mode...');
    this.webhookMode = false;
    this.isRunning = true;

    const pollingConfig = this.botConfigService.getBotConfig().polling;
    await this.bot.start({
      allowed_updates: [],
      drop_pending_updates: pollingConfig?.dropPendingUpdates,
      onStart: () => {
        this.logger.log('Bot started successfully in polling mode');
      },
    });
  }

  /**
   * Start bot in webhook mode (production)
   * Sets up webhook with Telegram and prepares bot to receive updates via HTTP
   *
   * @param webhookConfig - Webhook configuration
   * @returns Promise<void>
   */
  private async startWebhook(webhookConfig: {
    url: string;
    secretToken?: string;
    maxConnections?: number;
  }): Promise<void> {
    if (!this.bot) {
      throw new Error('Bot not initialized');
    }

    this.logger.log('Starting bot in webhook mode...');
    this.logger.log(`Webhook URL: ${webhookConfig.url}`);

    // Set webhook with Telegram
    await this.bot.api.setWebhook(webhookConfig.url, {
      secret_token: webhookConfig.secretToken,
      max_connections: webhookConfig.maxConnections || 40,
      drop_pending_updates: false,
    });

    // Verify webhook was set
    const webhookInfo = await this.bot.api.getWebhookInfo();
    this.logger.log('Webhook set successfully', {
      url: webhookInfo.url,
      hasCustomCertificate: webhookInfo.has_custom_certificate,
      pendingUpdateCount: webhookInfo.pending_update_count,
      maxConnections: webhookInfo.max_connections,
    });

    this.webhookMode = true;
    this.isRunning = true;

    this.logger.log('Bot started successfully in webhook mode');
  }

  /**
   * Stop the bot and clean up resources
   * Removes webhook if in webhook mode
   *
   * @returns Promise<void>
   */
  async stop(): Promise<void> {
    if (!this.bot || !this.isRunning) {
      return;
    }

    try {
      this.logger.log('Stopping bot...');

      // Remove webhook if in webhook mode
      if (this.webhookMode) {
        await this.stopWebhook();
      } else {
        // Stop polling
        await this.bot.stop();
      }

      this.isRunning = false;
      this.logger.log('Bot stopped successfully');
    } catch (err: unknown) {
      this.logger.error('Failed to stop bot', {
        error: unknownToError(err),
      });
    }
  }

  /**
   * Stop webhook mode and delete webhook from Telegram
   *
   * @returns Promise<void>
   */
  private async stopWebhook(): Promise<void> {
    if (!this.bot) {
      return;
    }

    this.logger.log('Removing webhook...');

    try {
      await this.bot.api.deleteWebhook({ drop_pending_updates: false });
      this.logger.log('Webhook removed successfully');
    } catch (err: unknown) {
      this.logger.error('Failed to remove webhook', {
        error: unknownToError(err),
      });
    }

    this.webhookMode = false;
  }

  /**
   * Handle incoming webhook update
   * Called by BotWebhookController when update is received
   *
   * @param update - Telegram update object
   * @returns Promise<void>
   */
  async handleWebhookUpdate(update: Update): Promise<void> {
    if (!this.bot) {
      throw new Error('Bot not initialized');
    }

    if (!this.webhookMode) {
      this.logger.warn('Received webhook update but not in webhook mode');

      return;
    }

    // Process update through Grammy bot
    // Grammy's handleUpdate accepts any update and processes it through the middleware chain
    await this.bot.handleUpdate(update);
  }

  /**
   * Check if bot is running in webhook mode
   *
   * @returns True if webhook mode, false if polling mode
   */
  isWebhookMode(): boolean {
    return this.webhookMode;
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
          : ctx.t('common.errors.something_went_wrong');

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
      // Copy authentication properties set by auth middleware
      // These are dynamically added to ctx by BotAuthMiddleware.authenticateUser()
      // Using property access since they're optional and dynamically set
      user: 'user' in ctx ? ctx.user : undefined,
      isAuthenticated: ctx.isAuthenticated,
      sessionId: 'sessionId' in ctx ? ctx.sessionId : undefined,
      isNewUser: 'isNewUser' in ctx ? ctx.isNewUser : undefined,
      userId: ctx.userId,
    };

    // Safe cast: We've constructed an object with all BotContext properties
    // TypeScript can't infer this automatically due to the complex nested structure
    return botContext as BotContext;
  }

  // Command handlers
  private async handleStartCommand(ctx: BotContext): Promise<void> {
    const message = ctx.t('menu.main_menu.select_action');

    // Centralized menu layout:
    // Row 1: Sell Traffic | Buy Traffic
    // Row 2: Profile | Balance
    // Row 3: Support
    await ctx.replyWithHTML(message, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: ctx.t('menu.main_menu.btn_sell_traffic'), callback_data: 'menu:sell_traffic' },
            { text: ctx.t('menu.main_menu.btn_buy_traffic'), callback_data: 'menu:buy_traffic' },
          ],
          [
            { text: ctx.t('menu.main_menu.btn_profile'), callback_data: 'profile:view' },
            { text: ctx.t('menu.main_menu.btn_balance'), callback_data: 'balance:view' },
          ],
          [{ text: ctx.t('menu.main_menu.btn_support'), callback_data: 'menu:support' }],
        ],
      },
    });
  }

  private async handleHelpCommand(ctx: BotContext): Promise<void> {
    const helpText = `
**${ctx.t('help.title')}**

**${ctx.t('help.available_commands')}**
${ctx.t('help.cmd_start')}
${ctx.t('help.cmd_menu')}
${ctx.t('help.cmd_profile')}
${ctx.t('help.cmd_balance')}
${ctx.t('help.cmd_settings')}
${ctx.t('help.cmd_help')}

**${ctx.t('help.features_title')}**
• ${ctx.t('help.feature_track')}
• ${ctx.t('help.feature_balance')}
• ${ctx.t('help.feature_traffic')}
• ${ctx.t('help.feature_prefs')}
• ${ctx.t('help.feature_stats')}

${ctx.t('help.support_hint')}
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        from: ctx.from!,
        data: 'menu:main',
        chat_instance: '',
      },
    };

    await this.callbackRouter.routeCallback(simulatedCallback as BotContext);
  }

  private async handleUnknownCommand(ctx: BotContext): Promise<void> {
    await ctx.reply(ctx.t('common.errors.unknown_command'));
  }

  private async sendAuthenticationRequired(ctx: BotContext): Promise<void> {
    await ctx.reply(ctx.t('common.errors.please_authenticate'));
  }
}
