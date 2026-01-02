import { Injectable, Logger } from '@nestjs/common';
import { BotCommand, BotContext, MenuType } from '@app/feature-bot-shared';
import { AuthService } from '@app/feature-auth-main';
import { AuthUserService } from '@app/feature-auth-shared';
import { UserService } from '@app/feature-user-main';
import { UserRole } from '@app/database';
import { SessionService } from '../service/session.service';
import { MenuService } from '../service/menu.service';
import { MessageService } from '../service/message.service';
import { toError, unknownToError } from '@app/common-shared';
import { InformationCommandHandler } from './commands';
import { InlineKeyboard } from 'grammy';

/**
 * Command Handler
 *
 * Handles all bot commands including user registration, authentication,
 * and primary bot functionality. Processes slash commands and provides
 * appropriate responses with menu navigation and user feedback.
 *
 * @class CommandHandler
 */
type CommandHandlerFn = (ctx: BotContext) => Promise<void>;

@Injectable()
export class CommandHandler {
  private readonly logger = new Logger(CommandHandler.name);
  private commandHandlers!: Map<BotCommand, CommandHandlerFn>;

  constructor(
    private readonly authService: AuthService,
    private readonly authUserService: AuthUserService,
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    private readonly menuService: MenuService,
    private readonly messageService: MessageService,
    private readonly informationCommandHandler: InformationCommandHandler,
  ) {
    this.initializeCommandHandlers();
  }

  private initializeCommandHandlers(): void {
    this.commandHandlers = new Map<BotCommand, CommandHandlerFn>([
      [BotCommand.Start, this.handleStartCommand.bind(this)],
      [BotCommand.Help, (ctx) => this.informationCommandHandler.handleHelpCommand(ctx)],
      [BotCommand.Profile, this.handleProfileCommand.bind(this)],
      [BotCommand.Settings, this.handleSettingsCommand.bind(this)],
      [BotCommand.Balance, (ctx) => this.informationCommandHandler.handleBalanceCommand(ctx)],
      [BotCommand.Stats, this.handleStatsCommand.bind(this)],
      [BotCommand.Campaign, this.handleCampaignCommand.bind(this)],
      [BotCommand.Withdraw, this.handleWithdrawCommand.bind(this)],
      [BotCommand.Referral, this.handleReferralCommand.bind(this)],
      [BotCommand.Traffic, this.handleTrafficCommand.bind(this)],
      [BotCommand.Admin, this.handleAdminCommand.bind(this)],
      [BotCommand.Cancel, this.handleCancelCommand.bind(this)],
      [BotCommand.Menu, this.handleMenuCommand.bind(this)],
      [BotCommand.Support, (ctx) => this.informationCommandHandler.handleSupportCommand(ctx)],
      [BotCommand.Language, (ctx) => this.informationCommandHandler.handleLanguageCommand(ctx)],
      [BotCommand.Verify, (ctx) => this.informationCommandHandler.handleVerifyCommand(ctx)],
      [BotCommand.Export, (ctx) => this.informationCommandHandler.handleExportCommand(ctx)],
      [BotCommand.Reset, (ctx) => this.informationCommandHandler.handleResetCommand(ctx)],
      [BotCommand.Status, (ctx) => this.informationCommandHandler.handleStatusCommand(ctx)],
    ]);
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
        chatType: ctx.chat?.type,
      });

      // Ensure user context exists for most commands
      if (!ctx.from && command !== BotCommand.Start) {
        await this.sendAuthenticationRequired(ctx);

        return;
      }

      const userId = ctx.from?.id?.toString();

      // Update user session with command activity
      if (userId) {
        await this.updateUserActivity(userId, command);
      }

      // Route command to appropriate handler using Map lookup
      const handler = this.commandHandlers.get(command);
      if (handler) {
        await handler(ctx);
      } else {
        await this.handleUnknownCommand(ctx, command);
      }
    } catch (err: unknown) {
      this.logger.error('Error processing command', {
        command,
        error: unknownToError(err),
        userId: ctx.from?.id,
        stack: err instanceof Error ? err.stack : undefined,
      });

      await this.handleCommandError(toError(err), ctx, command);
    }
  }

  /**
   * Handle /start command - bot initialization and user registration
   */
  private async handleStartCommand(ctx: BotContext): Promise<void> {
    const userName = ctx.from?.first_name || 'User';
    const userId = ctx.from?.id?.toString();

    try {
      // Check if user exists and create session
      if (userId) {
        const existingUser = await this.authUserService.findByPlatformId(userId);

        if (existingUser) {
          // Existing user - welcome back
          const welcomeBackKeyboard = new InlineKeyboard()
            .text(ctx.t('bot.commands.btn_sell_traffic'), 'menu:sell_traffic')
            .text(ctx.t('bot.commands.btn_buy_traffic'), 'menu:buy_traffic')
            .row()
            .text(ctx.t('bot.commands.btn_balance'), 'balance:view')
            .text(ctx.t('bot.commands.btn_profile'), 'profile:view')
            .row()
            .text(ctx.t('bot.commands.btn_support'), 'menu:support');

          await this.messageService.sendNewMessage(ctx, {
            text:
              `<b>${ctx.t('bot.commands.welcome_back', { name: userName })}</b>\n\n` +
              ctx.t('bot.commands.welcome_back_message') +
              `\n\n` +
              ctx.t('bot.commands.account_status') +
              `\n` +
              ctx.t('bot.commands.platform_status') +
              `\n` +
              `${ctx.t('bot.commands.user_id')} ${userId}\n\n` +
              ctx.t('bot.commands.use_menu'),
            parseMode: 'HTML',
            replyMarkup: welcomeBackKeyboard,
          });
        } else {
          // New user - registration flow
          const welcomeNewKeyboard = new InlineKeyboard()
            .text(ctx.t('bot.commands.btn_complete_setup'), 'auth:register')
            .row()
            .text(ctx.t('bot.commands.btn_sell_traffic'), 'menu:sell_traffic')
            .text(ctx.t('bot.commands.btn_buy_traffic'), 'menu:buy_traffic')
            .row()
            .text(ctx.t('bot.commands.btn_balance'), 'balance:view')
            .text(ctx.t('bot.commands.btn_help'), 'menu:help');

          await this.messageService.sendNewMessage(ctx, {
            text:
              `<b>${ctx.t('bot.commands.welcome_new')}</b>\n\n` +
              `${ctx.t('bot.commands.welcome_new_intro')}\n\n` +
              `<b>${ctx.t('bot.commands.help_features')}</b>\n\n` +
              ctx.t('bot.commands.feature_track') +
              `\n` +
              ctx.t('bot.commands.feature_monitor') +
              `\n` +
              ctx.t('bot.commands.feature_manage') +
              `\n` +
              ctx.t('bot.commands.feature_analytics') +
              `\n` +
              ctx.t('bot.commands.feature_withdraw') +
              `\n` +
              ctx.t('bot.commands.feature_optimize'),
            parseMode: 'HTML',
            replyMarkup: welcomeNewKeyboard,
          });
        }

        // Create or update session
        await this.sessionService.createSession(userId, {
          conversationState: {
            currentStep: 'authenticated',
            availableSteps: ['main_menu', 'registration'],
            context: {
              firstVisit: !existingUser,
              authenticated: !!existingUser,
            },
            isActive: true,
            startedAt: new Date(),
          },
        });
      }
    } catch (err: unknown) {
      this.logger.error('Error in start command', {
        error: unknownToError(err),
        userId,
      });

      await this.messageService.sendNewMessage(ctx, {
        text:
          ctx.t('bot.commands.welcome_new') +
          `\n\n` +
          ctx.t('bot.commands.error_fallback_intro') +
          `\n\n` +
          ctx.t('bot.commands.error_fallback_hint'),
      });
    }
  }

  /**
   * Handle /profile command - navigate to profile menu
   */
  private async handleProfileCommand(ctx: BotContext): Promise<void> {
    if (!this.checkAuthentication(ctx)) {
      return;
    }

    await this.menuService.navigateToMenu(ctx, MenuType.Profile);
  }

  /**
   * Handle /settings command - navigate to settings menu
   */
  private async handleSettingsCommand(ctx: BotContext): Promise<void> {
    if (!this.checkAuthentication(ctx)) {
      return;
    }

    await this.menuService.navigateToMenu(ctx, MenuType.Settings);
  }

  /**
   * Handle /stats command - navigate to statistics menu
   */
  private async handleStatsCommand(ctx: BotContext): Promise<void> {
    if (!this.checkAuthentication(ctx)) {
      return;
    }

    await this.menuService.navigateToMenu(ctx, MenuType.Statistics);
  }

  /**
   * Handle /campaign command - navigate to campaign menu
   */
  private async handleCampaignCommand(ctx: BotContext): Promise<void> {
    if (!this.checkAuthentication(ctx)) {
      return;
    }

    await this.menuService.navigateToMenu(ctx, MenuType.Campaign);
  }

  /**
   * Handle /withdraw command - navigate to withdrawal menu
   */
  private async handleWithdrawCommand(ctx: BotContext): Promise<void> {
    if (!this.checkAuthentication(ctx)) {
      return;
    }

    await this.menuService.navigateToMenu(ctx, MenuType.Withdrawal);
  }

  /**
   * Handle /referral command - navigate to referral menu
   */
  private async handleReferralCommand(ctx: BotContext): Promise<void> {
    if (!this.checkAuthentication(ctx)) {
      return;
    }

    await this.menuService.navigateToMenu(ctx, MenuType.Referral);
  }

  /**
   * Handle /traffic command - navigate to traffic menu
   */
  private async handleTrafficCommand(ctx: BotContext): Promise<void> {
    if (!this.checkAuthentication(ctx)) {
      return;
    }

    await this.menuService.navigateToMenu(ctx, MenuType.Traffic);
  }

  /**
   * Handle /admin command - admin panel access (restricted)
   */
  private async handleAdminCommand(ctx: BotContext): Promise<void> {
    if (!this.checkAuthentication(ctx)) {
      return;
    }

    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return;
    }

    try {
      const user = await this.authUserService.findByPlatformId(userId);
      if (!user || user.role === UserRole.User) {
        await this.messageService.sendNewMessage(ctx, { text: ctx.t('common.errors.access_denied_admin') });

        return;
      }

      await this.menuService.navigateToMenu(ctx, MenuType.Admin);
    } catch (err: unknown) {
      this.logger.error('Error checking admin access', {
        error: unknownToError(err),
        userId,
      });

      await this.messageService.sendNewMessage(ctx, { text: ctx.t('common.errors.admin_verify_error') });
    }
  }

  /**
   * Handle /cancel command - cancel current operation
   */
  private async handleCancelCommand(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id?.toString();

    if (userId) {
      // Clear any ongoing operations from session
      await this.sessionService.updateSession(userId, {
        conversationState: {
          currentStep: 'main_menu',
          availableSteps: ['main_menu'],
          context: { cancelled: true },
          isActive: true,
          startedAt: new Date(),
        },
        formData: {}, // Clear any form data
      });
    }

    const keyboard = new InlineKeyboard().text(ctx.t('bot.menu.main'), 'menu:main');
    await this.messageService.sendNewMessage(ctx, {
      text: ctx.t('common.errors.operation_cancelled'),
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle /menu command - return to main menu
   */
  private async handleMenuCommand(ctx: BotContext): Promise<void> {
    await this.menuService.navigateToMenu(ctx, MenuType.Main);
  }

  /**
   * Handle unknown command
   */
  private async handleUnknownCommand(ctx: BotContext, command: BotCommand): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text('❓ Help', 'menu:help')
      .text('📋 Main Menu', 'menu:main')
      .row()
      .text('💰 Balance', 'menu:balance')
      .text('📈 Statistics', 'menu:statistics');

    await this.messageService.sendNewMessage(ctx, {
      text: ctx.t('common.errors.unknown_command_help', { command }),
      replyMarkup: keyboard,
    });
  }

  /**
   * Send authentication required message
   */
  private async sendAuthenticationRequired(ctx: BotContext): Promise<void> {
    const keyboard = new InlineKeyboard().text('🚀 Start Bot', 'auth:start');
    await this.messageService.sendNewMessage(ctx, {
      text: ctx.t('common.errors.auth_required_start'),
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle command processing errors
   */
  private async handleCommandError(error: Error, ctx: BotContext, command: BotCommand): Promise<void> {
    const userId = ctx.from?.id;

    // Log error details
    this.logger.error('Command processing error', {
      command,
      userId,
      error: error.message,
      stack: error.stack,
    });

    // Send user-friendly error message
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? `Error processing command /${command}: ${error.message}`
        : 'Sorry, something went wrong processing your request. Please try again or contact support if the problem persists.';

    try {
      const keyboard = new InlineKeyboard()
        .text('🔄 Try Again', `command:${command}`)
        .text('📋 Main Menu', 'menu:main')
        .row()
        .text('🆘 Support', 'help:contact');

      await this.messageService.sendNewMessage(ctx, {
        text: errorMessage,
        replyMarkup: keyboard,
      });
    } catch (replyError) {
      this.logger.error('Failed to send error message', {
        originalError: error.message,
        replyError: replyError instanceof Error ? replyError.message : String(replyError),
        userId,
        command,
      });
    }
  }

  /**
   * Check if user is authenticated
   */
  private async checkAuthentication(ctx: BotContext): Promise<boolean> {
    if (!ctx.from?.id) {
      await this.sendAuthenticationRequired(ctx);

      return false;
    }

    return true;
  }

  /**
   * Update user activity in session
   */
  private async updateUserActivity(userId: string, command: BotCommand): Promise<void> {
    try {
      await this.sessionService.updateSession(userId, {
        conversationState: {
          currentStep: `command_${command}`,
          context: {
            lastCommand: command,
            lastCommandAt: new Date().toISOString(),
          },
          isActive: true,
        },
      });
    } catch (err: unknown) {
      // Log error but don't fail command processing
      this.logger.error('Failed to update user activity', {
        userId,
        command,
        error: unknownToError(err),
      });
    }
  }
}
