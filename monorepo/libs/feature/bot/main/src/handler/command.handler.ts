import { Injectable, Logger } from '@nestjs/common';
import { BotContext, BotCommand, MenuType } from '@app/feature-bot-shared';
import { AuthService } from '@app/feature-auth-main';
import { AuthUserService } from '@app/feature-auth-shared';
import { BalanceService } from '@app/feature-balance-main';
import { UserService } from '@app/feature-user-main';
import { SessionService } from '../service/session.service';
import { MenuService } from '../service/menu.service';
import { AsyncResult } from '@app/common-shared';
import { Ok, Err } from 'ts-results';

/**
 * Command Handler
 *
 * Handles all bot commands including user registration, authentication,
 * and primary bot functionality. Processes slash commands and provides
 * appropriate responses with menu navigation and user feedback.
 *
 * @class CommandHandler
 */
@Injectable()
export class CommandHandler {
  private readonly logger = new Logger(CommandHandler.name);

  constructor(
    private readonly authService: AuthService,
    private readonly authUserService: AuthUserService,
    private readonly balanceService: BalanceService,
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    private readonly menuService: MenuService,
  ) {}

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

      // Route command to appropriate handler
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
        case BotCommand.Stats:
          await this.handleStatsCommand(ctx);
          break;
        case BotCommand.Campaign:
          await this.handleCampaignCommand(ctx);
          break;
        case BotCommand.Withdraw:
          await this.handleWithdrawCommand(ctx);
          break;
        case BotCommand.Referral:
          await this.handleReferralCommand(ctx);
          break;
        case BotCommand.Traffic:
          await this.handleTrafficCommand(ctx);
          break;
        case BotCommand.Admin:
          await this.handleAdminCommand(ctx);
          break;
        case BotCommand.Cancel:
          await this.handleCancelCommand(ctx);
          break;
        case BotCommand.Menu:
          await this.handleMenuCommand(ctx);
          break;
        case BotCommand.Support:
          await this.handleSupportCommand(ctx);
          break;
        case BotCommand.Language:
          await this.handleLanguageCommand(ctx);
          break;
        case BotCommand.Verify:
          await this.handleVerifyCommand(ctx);
          break;
        case BotCommand.Export:
          await this.handleExportCommand(ctx);
          break;
        case BotCommand.Reset:
          await this.handleResetCommand(ctx);
          break;
        case BotCommand.Status:
          await this.handleStatusCommand(ctx);
          break;
        default:
          await this.handleUnknownCommand(ctx, command);
      }
    } catch (err: unknown) {
      this.logger.error('Error processing command', {
        command,
        error: unknownToError(err),
        userId: ctx.from?.id,
        stack: error instanceof Error ? err.stack : undefined,
      });

      await this.handleCommandError(error as Error, ctx, command);
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
          await ctx.replyWithHTML(
            `<b>Welcome back, ${userName}! 👋</b>\n\n` +
              `Great to see you again! Your account is ready to use.\n\n` +
              `✅ Account: Active\n` +
              `📱 Platform: Telegram Bot\n` +
              `🆔 ID: ${userId}\n\n` +
              `Use the menu below to access your dashboard:`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '📋 Main Menu', callback_data: 'menu:main' },
                    { text: '💰 Balance', callback_data: 'menu:balance' },
                  ],
                  [
                    { text: '📈 Statistics', callback_data: 'menu:statistics' },
                    { text: '⚙️ Settings', callback_data: 'menu:settings' },
                  ],
                  [{ text: '❓ Help', callback_data: 'menu:help' }],
                ],
              },
            },
          );
        } else {
          // New user - registration flow
          await ctx.replyWithHTML(
            `<b>Welcome to MotivBuy! 🚀</b>\n\n` +
              `Hello <b>${userName}</b>, I'm your personal traffic campaign assistant!\n\n` +
              `🎯 <b>What I can help you with:</b>\n` +
              `• Track your traffic campaign performance\n` +
              `• Monitor earnings and balance in real-time\n` +
              `• Manage multiple traffic sources\n` +
              `• Generate detailed analytics reports\n` +
              `• Handle withdrawals and payments\n` +
              `• Optimize your campaigns for better results\n\n` +
              `Let's get you set up! 🛠️`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '✅ Complete Setup', callback_data: 'auth:register' }],
                  [
                    { text: '📋 Main Menu', callback_data: 'menu:main' },
                    { text: '❓ Help', callback_data: 'menu:help' },
                  ],
                ],
              },
            },
          );
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

      await ctx.reply(
        `Welcome to MotivBuy! 🚀\n\n` +
          `I'm here to help you manage your traffic campaigns and earnings.\n\n` +
          `Use /menu to see available options or /help for assistance.`,
      );
    }
  }

  /**
   * Handle /help command - comprehensive help information
   */
  private async handleHelpCommand(ctx: BotContext): Promise<void> {
    const helpText = `
<b>🤖 MotivBuy Bot Help Center</b>

<b>📋 Available Commands:</b>
/start - Start or restart the bot
/menu - Open main menu
/profile - View your profile
/balance - Check your balance and earnings
/stats - View detailed statistics
/campaign - Manage your campaigns
/traffic - Traffic analytics
/withdraw - Request withdrawals
/referral - Referral program
/settings - Manage preferences
/help - Show this help message
/support - Contact support team
/status - Check account status

<b>🎯 Main Features:</b>
• <b>Campaign Tracking</b> - Monitor all your traffic campaigns
• <b>Real-time Analytics</b> - Live performance metrics
• <b>Balance Management</b> - Track earnings and request withdrawals
• <b>Traffic Sources</b> - Manage multiple traffic channels
• <b>Referral System</b> - Earn by inviting others
• <b>Detailed Reports</b> - Export comprehensive analytics

<b>🚀 Quick Actions:</b>
• Use inline buttons for faster navigation
• Check your balance with /balance
• View live stats with /stats
• Access settings with /settings

<b>💡 Tips:</b>
• Keep your profile updated for better service
• Enable notifications to stay informed
• Use the referral program to earn extra income
• Check analytics regularly to optimize performance

<b>🆘 Need Help?</b>
• Use /support for direct assistance
• Check our FAQ in the help menu
• Contact support: @motivbuy_support

<i>Version 1.0 | Last updated: ${new Date().toLocaleDateString()}</i>
`;

    await ctx.replyWithHTML(helpText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📞 Contact Support', callback_data: 'help:contact' },
            { text: '📚 FAQ', callback_data: 'help:faq' },
          ],
          [{ text: '📋 Main Menu', callback_data: 'menu:main' }],
        ],
      },
    });
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
   * Handle /balance command - show balance information
   */
  private async handleBalanceCommand(ctx: BotContext): Promise<void> {
    if (!this.checkAuthentication(ctx)) {
      return;
    }

    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return;
    }

    try {
      // Get user balance information
      const user = await this.authUserService.findByPlatformId(userId);
      if (!user) {
        await ctx.reply('User not found. Please use /start to register.');

        return;
      }

      // Get balance details
      const balance = await this.balanceService.getBalance(user.id);

      const balanceText = `
<b>💰 Your Balance</b>

<b>💵 Current Balance:</b> $${balance.availableAmount.toFixed(2)}
<b>🔒 Pending:</b> $${balance.pendingAmount.toFixed(2)}
<b>📊 Total Earned:</b> $${balance.totalEarned.toFixed(2)}

<b>📈 Recent Activity:</b>
• Last transaction: ${balance.lastTransactionAt ? new Date(balance.lastTransactionAt).toLocaleDateString() : 'No transactions yet'}
• Account created: ${new Date(user.createdAt).toLocaleDateString()}

<b>💸 Withdrawal Status:</b>
• Available for withdrawal: $${balance.availableAmount.toFixed(2)}
• Minimum withdrawal: $10.00
`;

      await ctx.replyWithHTML(balanceText, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💸 Withdraw', callback_data: 'menu:withdrawal' },
              { text: '📈 History', callback_data: 'balance:history' },
            ],
            [
              { text: '📊 Analytics', callback_data: 'balance:analytics' },
              { text: '🔄 Refresh', callback_data: 'balance:current' },
            ],
            [{ text: '⬅️ Back', callback_data: 'menu:main' }],
          ],
        },
      });
    } catch (err: unknown) {
      this.logger.error('Error fetching balance', {
        error: unknownToError(err),
        userId,
      });

      await ctx.reply('Unable to fetch balance information. Please try again later.');
    }
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
      if (!user || !user.isAdmin) {
        await ctx.reply('❌ Access denied. Admin privileges required.');

        return;
      }

      await this.menuService.navigateToMenu(ctx, MenuType.Admin);
    } catch (err: unknown) {
      this.logger.error('Error checking admin access', {
        error: unknownToError(err),
        userId,
      });

      await ctx.reply('❌ Unable to verify admin access. Please try again later.');
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

    await ctx.reply('❌ Operation cancelled.\n\nReturning to main menu...', {
      reply_markup: {
        inline_keyboard: [[{ text: '📋 Main Menu', callback_data: 'menu:main' }]],
      },
    });
  }

  /**
   * Handle /menu command - return to main menu
   */
  private async handleMenuCommand(ctx: BotContext): Promise<void> {
    await this.menuService.navigateToMenu(ctx, MenuType.Main);
  }

  /**
   * Handle /support command - contact support
   */
  private async handleSupportCommand(ctx: BotContext): Promise<void> {
    const supportText = `
<b>🆘 Support & Contact</b>

<b>📧 Contact Methods:</b>
• Telegram Support: @motivbuy_support
• Email: support@motivbuy.com
• Response time: Usually within 2-4 hours

<b>🔥 Quick Help:</b>
• Check our FAQ for common questions
• Use /help for bot commands
• Report bugs or issues directly

<b>📋 When contacting support, please include:</b>
• Your user ID: ${ctx.from?.id || 'Unknown'}
• Description of the issue
• Screenshots if applicable
• Steps to reproduce the problem

<b>🕐 Support Hours:</b>
Monday - Friday: 9:00 AM - 6:00 PM UTC
Weekend: Limited support available

<i>We're here to help you succeed! 🚀</i>
`;

    await ctx.replyWithHTML(supportText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 Contact Support', url: 'https://t.me/motivbuy_support' }],
          [
            { text: '📚 FAQ', callback_data: 'help:faq' },
            { text: '🐛 Report Bug', callback_data: 'help:bug_report' },
          ],
          [{ text: '⬅️ Back', callback_data: 'menu:main' }],
        ],
      },
    });
  }

  /**
   * Handle /language command - language selection
   */
  private async handleLanguageCommand(ctx: BotContext): Promise<void> {
    const languageText = `
<b>🌍 Language Settings</b>

Select your preferred language:

<i>Currently supported languages:</i>
`;

    await ctx.replyWithHTML(languageText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🇺🇸 English', callback_data: 'settings:language:en' },
            { text: '🇪🇸 Español', callback_data: 'settings:language:es' },
          ],
          [
            { text: '🇫🇷 Français', callback_data: 'settings:language:fr' },
            { text: '🇩🇪 Deutsch', callback_data: 'settings:language:de' },
          ],
          [
            { text: '🇷🇺 Русский', callback_data: 'settings:language:ru' },
            { text: '🇨🇳 中文', callback_data: 'settings:language:zh' },
          ],
          [{ text: '⬅️ Back to Settings', callback_data: 'menu:settings' }],
        ],
      },
    });
  }

  /**
   * Handle /verify command - account verification
   */
  private async handleVerifyCommand(ctx: BotContext): Promise<void> {
    if (!this.checkAuthentication(ctx)) {
      return;
    }

    const verificationText = `
<b>✅ Account Verification</b>

Verify your account to unlock all features:

<b>🔒 Current Status:</b>
• Identity: Not verified
• Email: Not verified
• Phone: Not verified
• Payment methods: Basic

<b>🎯 Verification Benefits:</b>
• Higher withdrawal limits
• Priority support
• Advanced analytics
• Premium features access
• Enhanced security

<b>📋 Required Documents:</b>
• Government-issued ID
• Proof of address
• Email confirmation
`;

    await ctx.replyWithHTML(verificationText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📧 Verify Email', callback_data: 'verify:email' },
            { text: '📱 Verify Phone', callback_data: 'verify:phone' },
          ],
          [{ text: '🆔 Identity Verification', callback_data: 'verify:identity' }],
          [{ text: '⬅️ Back', callback_data: 'menu:profile' }],
        ],
      },
    });
  }

  /**
   * Handle /export command - data export
   */
  private async handleExportCommand(ctx: BotContext): Promise<void> {
    if (!this.checkAuthentication(ctx)) {
      return;
    }

    const exportText = `
<b>📥 Data Export</b>

Export your data in various formats:

<b>📊 Available Exports:</b>
• Transaction history (CSV, PDF)
• Campaign analytics (Excel, PDF)
• Traffic reports (CSV, JSON)
• Account summary (PDF)
• Full data archive (ZIP)

<b>⏰ Processing Time:</b>
• Small reports: Instant
• Large datasets: 5-10 minutes
• Full archive: Up to 30 minutes

<i>Exported files will be sent as documents to this chat.</i>
`;

    await ctx.replyWithHTML(exportText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💰 Transactions', callback_data: 'export:transactions' },
            { text: '📈 Analytics', callback_data: 'export:analytics' },
          ],
          [
            { text: '🎯 Traffic Reports', callback_data: 'export:traffic' },
            { text: '📋 Account Summary', callback_data: 'export:summary' },
          ],
          [{ text: '📦 Full Archive', callback_data: 'export:full' }],
          [{ text: '⬅️ Back', callback_data: 'menu:settings' }],
        ],
      },
    });
  }

  /**
   * Handle /reset command - reset account data
   */
  private async handleResetCommand(ctx: BotContext): Promise<void> {
    if (!this.checkAuthentication(ctx)) {
      return;
    }

    const resetText = `
<b>🔄 Reset Account Data</b>

<b>⚠️ WARNING:</b> This action will reset various parts of your account data.

<b>🔴 What can be reset:</b>
• Session data and preferences
• Cached analytics data
• Notification settings
• Menu navigation history
• Temporary form data

<b>✅ What remains unchanged:</b>
• Your account and profile
• Balance and transactions
• Campaign data
• Traffic history
• Referral information

<i>Choose what you want to reset:</i>
`;

    await ctx.replyWithHTML(resetText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🗂️ Reset Session Data', callback_data: 'reset:session' }],
          [
            { text: '🔔 Reset Notifications', callback_data: 'reset:notifications' },
            { text: '⚙️ Reset Preferences', callback_data: 'reset:preferences' },
          ],
          [{ text: '🧹 Clear Cache', callback_data: 'reset:cache' }],
          [{ text: '❌ Cancel', callback_data: 'menu:settings' }],
        ],
      },
    });
  }

  /**
   * Handle /status command - show account status
   */
  private async handleStatusCommand(ctx: BotContext): Promise<void> {
    if (!this.checkAuthentication(ctx)) {
      return;
    }

    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return;
    }

    try {
      const user = await this.authUserService.findByPlatformId(userId);
      if (!user) {
        await ctx.reply('User not found. Please use /start to register.');

        return;
      }

      const session = await this.sessionService.getSession(userId);
      const balance = await this.balanceService.getBalance(user.id);

      const statusText = `
<b>📊 Account Status</b>

<b>👤 Profile Information:</b>
• Name: ${user.firstName} ${user.lastName || ''}
• Username: ${user.username || 'Not set'}
• User ID: ${user.id}
• Platform ID: ${userId}

<b>🔐 Account Status:</b>
• Status: ${user.isActive ? '✅ Active' : '❌ Inactive'}
• Verified: ${user.isVerified ? '✅ Verified' : '❌ Not verified'}
• Admin: ${user.isAdmin ? '✅ Yes' : '❌ No'}
• Member since: ${new Date(user.createdAt).toLocaleDateString()}

<b>💰 Financial Status:</b>
• Current balance: $${balance.availableAmount.toFixed(2)}
• Total earned: $${balance.totalEarned.toFixed(2)}
• Last transaction: ${balance.lastTransactionAt ? new Date(balance.lastTransactionAt).toLocaleDateString() : 'None'}

<b>📱 Session Info:</b>
• Session active: ${session ? '✅ Yes' : '❌ No'}
• Last active: ${session ? new Date(session.updatedAt).toLocaleString() : 'Unknown'}
• Current location: ${session?.data.navigationState?.currentLocation || 'Unknown'}

<b>🔔 Notifications:</b>
• Push notifications: ${session?.data.preferences?.notifications?.enablePush ? '✅ Enabled' : '❌ Disabled'}
• Language: ${session?.data.preferences?.language || 'en'}
`;

      await ctx.replyWithHTML(statusText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Refresh Status', callback_data: 'status:refresh' }],
            [
              { text: '⚙️ Settings', callback_data: 'menu:settings' },
              { text: '📋 Main Menu', callback_data: 'menu:main' },
            ],
          ],
        },
      });
    } catch (err: unknown) {
      this.logger.error('Error fetching status', {
        error: unknownToError(err),
        userId,
      });

      await ctx.reply('Unable to fetch status information. Please try again later.');
    }
  }

  /**
   * Handle unknown command
   */
  private async handleUnknownCommand(ctx: BotContext, command: BotCommand): Promise<void> {
    await ctx.reply(`I don't understand the command "${command}". 🤔\n\n` + 'Here are some commands you can try:', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '❓ Help', callback_data: 'menu:help' },
            { text: '📋 Main Menu', callback_data: 'menu:main' },
          ],
          [
            { text: '💰 Balance', callback_data: 'menu:balance' },
            { text: '📈 Statistics', callback_data: 'menu:statistics' },
          ],
        ],
      },
    });
  }

  /**
   * Send authentication required message
   */
  private async sendAuthenticationRequired(ctx: BotContext): Promise<void> {
    await ctx.reply('🔒 Authentication required.\n\nPlease use /start to begin.', {
      reply_markup: {
        inline_keyboard: [[{ text: '🚀 Start Bot', callback_data: 'auth:start' }]],
      },
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
      stack: err.stack,
    });

    // Send user-friendly error message
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? `Error processing command /${command}: ${error.message}`
        : 'Sorry, something went wrong processing your request. Please try again or contact support if the problem persists.';

    try {
      await ctx.reply(errorMessage, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Try Again', callback_data: `command:${command}` },
              { text: '📋 Main Menu', callback_data: 'menu:main' },
            ],
            [{ text: '🆘 Support', callback_data: 'help:contact' }],
          ],
        },
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
