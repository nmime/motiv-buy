import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Bot, Context, session, SessionFlavor } from 'grammy';
import { BotContext, BotCommand } from '@app/feature-bot-shared';
import { BotConfigService } from '../config';
import { AsyncResult } from '@app/common-shared';
import { Ok, Err } from 'ts-results';

/**
 * Extended Grammy Context with session support
 */
interface BotSessionContext extends Context, SessionFlavor<Record<string, any>> {
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
        throw new Error('Bot token is not configured');
      }

      // Create Grammy bot instance
      this.bot = new Bot<BotSessionContext>(botToken);

      // Install session middleware
      this.bot.use(
        session({
          initial: () => ({}),
        }),
      );

      // Install basic context setup middleware
      this.bot.use(async (ctx, next) => {
        // Set up basic user context
        if (ctx.from) {
          (ctx as any).userId = ctx.from.id.toString();
          (ctx as any).isAuthenticated = true; // Simplified for now
        }
        await next();
      });

      // Install error handling middleware
      this.bot.catch(async (err) => {
        const { ctx } = err;
        const error = err.error as Error;
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

      this.logger.log('Bot service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize bot service', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Start the bot polling
   *
   * @returns Promise<void>
   */
  async start(): Promise<void> {
    if (!this.bot) {
      throw new Error('Bot is not initialized');
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
    } catch (error) {
      this.isRunning = false;
      this.logger.error('Failed to start bot', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
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
    } catch (error) {
      this.logger.error('Failed to stop bot', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

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

      switch (command) {
        case BotCommand.Start:
          await this.handleStartCommand(ctx);
          break;
        case BotCommand.Help:
          await this.handleHelpCommand(ctx);
          break;
        case BotCommand.Profile:
          await this.handleProfileCommand(ctx);
          break;
        case BotCommand.Settings:
          await this.handleSettingsCommand(ctx);
          break;
        case BotCommand.Balance:
          await this.handleBalanceCommand(ctx);
          break;
        case BotCommand.Menu:
          await this.handleMenuCommand(ctx);
          break;
        default:
          await this.handleUnknownCommand(ctx);
      }
    } catch (error) {
      this.logger.error('Error processing command', {
        command,
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.from?.id,
      });

      await this.handleError(error as Error, ctx);
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
      const callbackData = ctx.callbackQuery.data;

      // Handle callback queries (simplified for now)
      await ctx.answerCallbackQuery('Feature coming soon!');
    });
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
        return await ctx.answerCallbackQuery(text, extra);
      },
      session: ctx.session,
      state: ctx.userData,
    };
  }

  // Command handlers
  private async handleStartCommand(ctx: BotContext): Promise<void> {
    await ctx.reply(
      'Welcome to MotivBuy! 🚀\n\n' +
        "I'm here to help you manage your traffic campaigns and earnings.\n\n" +
        'Use /menu to see available options or /help for assistance.',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 Main Menu', callback_data: 'menu:main' },
              { text: '❓ Help', callback_data: 'menu:help' },
            ],
          ],
        },
      },
    );
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
    await ctx.reply('👤 Profile feature coming soon!');
  }

  private async handleSettingsCommand(ctx: BotContext): Promise<void> {
    await ctx.reply('⚙️ Settings feature coming soon!');
  }

  private async handleBalanceCommand(ctx: BotContext): Promise<void> {
    await ctx.reply('💰 Balance feature coming soon!');
  }

  private async handleMenuCommand(ctx: BotContext): Promise<void> {
    await ctx.reply('📋 Main menu feature coming soon!');
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
