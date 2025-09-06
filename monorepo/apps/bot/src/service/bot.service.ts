import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context } from 'grammy';
import { UserService } from '@app/feature-user-main';

/**
 * Bot Service
 *
 * Main service for handling Telegram bot interactions.
 * Thin layer that delegates to domain services.
 */
@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);
  private bot: Bot<Context>;

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }

    this.bot = new Bot(token);
    this.setupHandlers();
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    try {
      await this.bot.start();
      this.logger.log('Bot started successfully');
    } catch (error) {
      this.logger.error('Failed to start bot', error);
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    try {
      await this.bot.stop();
      this.logger.log('Bot stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping bot', error);
    }
  }

  /**
   * Setup bot command and message handlers
   */
  private setupHandlers(): void {
    this.bot.command('start', async (ctx) => {
      await this.handleStartCommand(ctx);
    });

    this.bot.command('help', async (ctx) => {
      await this.handleHelpCommand(ctx);
    });

    this.bot.on('message', async (ctx) => {
      await this.handleMessage(ctx);
    });

    this.bot.catch((err) => {
      this.logger.error('Bot error occurred', err);
    });
  }

  /**
   * Handle /start command
   */
  private async handleStartCommand(ctx: Context): Promise<void> {
    try {
      const user = ctx.from;
      if (!user) return;

      let userRecord;
      try {
        userRecord = await this.userService.getUserByTelegramId(user.id.toString());
      } catch (error) {
        userRecord = await this.userService.createUser({
          telegramId: user.id.toString(),
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          languageCode: user.language_code,
        });

        this.logger.log(`New user registered: ${user.id}`);
      }

      await ctx.reply(
        `Welcome to Motiv-Buy! 🛍️\\n\\n` +
          `Hello ${userRecord.firstName}! I'm here to help you with your shopping motivation.\\n\\n` +
          `Use /help to see available commands.`,
      );

      await this.userService.updateLastActive(userRecord.id);
    } catch (error) {
      this.logger.error('Error handling start command', error);
      await ctx.reply('Sorry, something went wrong. Please try again later.');
    }
  }

  /**
   * Handle /help command
   */
  private async handleHelpCommand(ctx: Context): Promise<void> {
    const helpMessage = `
🤖 **Motiv-Buy Bot Commands:**

/start - Start using the bot
/help - Show this help message

💡 **Features:**
• User management
• Shopping motivation
• Premium features

📞 **Support:**
Contact our team if you need assistance.
    `;

    await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
  }

  /**
   * Handle regular messages
   */
  private async handleMessage(ctx: Context): Promise<void> {
    try {
      const user = ctx.from;
      if (!user) return;

      try {
        const userRecord = await this.userService.getUserByTelegramId(user.id.toString());
        await this.userService.updateLastActive(userRecord.id);
      } catch (error) {}

      await ctx.reply("I'm not sure how to help with that. Use /help to see available commands.");
    } catch (error) {
      this.logger.error('Error handling message', error);
    }
  }
}
