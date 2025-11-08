/* eslint-disable @nx/enforce-module-boundaries */
import { unknownToError } from '@app/common-shared';
import { Injectable, Logger } from '@nestjs/common';
import { BotContext, MenuType } from '@app/feature-bot-shared';
import { AuthService } from '@app/feature-auth-main';
import { AuthUserService } from '@app/feature-auth-shared';
import { BalanceService } from '@app/feature-balance-main';
import { UserService } from '@app/feature-user-main';
import { PlatformType } from '@app/database';
import { SessionService } from '../service/session.service';
import { MenuService } from '../service/menu.service';
import { MenuHandler } from './menu.handler';

/**
 * Callback Handler
 *
 * Handles all inline keyboard callback queries from Telegram bot interactions.
 * Processes button presses, manages user authentication flows, and coordinates
 * between different handler types for seamless user experience.
 *
 * @class CallbackHandler
 */
@Injectable()
export class CallbackHandler {
  private readonly logger = new Logger(CallbackHandler.name);

  constructor(
    private readonly authService: AuthService,
    private readonly authUserService: AuthUserService,
    private readonly balanceService: BalanceService,
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    private readonly menuService: MenuService,
    private readonly menuHandler: MenuHandler,
  ) {}

  /**
   * Process incoming callback query
   *
   * @param ctx - Bot context with callback query data
   * @returns Promise<void>
   */
  async processCallbackQuery(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.callbackQuery?.data) {
        this.logger.warn('Callback query received without data', {
          userId: ctx.from?.id,
          callbackQueryId: ctx.callbackQuery?.id,
        });

        await ctx.answerCallbackQuery('Invalid callback data');

        return;
      }

      const callbackData = ctx.callbackQuery.data;
      const userId = ctx.from?.id?.toString();

      this.logger.debug(`Processing callback query: ${callbackData}`, {
        userId,
        callbackData,
      });

      // Parse callback data
      const [action, ...params] = callbackData.split(':');

      // Update user activity
      if (userId) {
        await this.updateCallbackActivity(userId, callbackData);
      }

      // Route callback to appropriate handler
      await this.routeCallback(ctx, action, params);

      // Always answer callback query to remove loading state
      await ctx.answerCallbackQuery();
    } catch (err: unknown) {
      this.logger.error('Error processing callback query', {
        error: unknownToError(err),
        userId: ctx.from?.id,
        callbackData: ctx.callbackQuery?.data,
        stack: err instanceof Error ? err.stack : undefined,
      });

      // Answer callback query with error
      try {
        await ctx.answerCallbackQuery('Something went wrong. Please try again.');
      } catch (answerError) {
        this.logger.error('Failed to answer callback query', {
          answerError: answerError instanceof Error ? answerError.message : String(answerError),
        });
      }

      await this.handleCallbackError(ctx, err as Error);
    }
  }

  /**
   * Route callback to appropriate handler based on action type
   *
   * @param ctx - Bot context
   * @param action - Action type from callback data
   * @param params - Additional parameters
   * @returns Promise<void>
   */
  private async routeCallback(ctx: BotContext, action: string, params: string[]): Promise<void> {
    switch (action) {
      case 'menu':
        await this.handleMenuCallback(ctx, params);
        break;

      case 'auth':
        await this.handleAuthCallback(ctx, params);
        break;

      case 'profile':
        await this.handleProfileCallback(ctx, params);
        break;

      case 'settings':
        await this.handleSettingsCallback(ctx, params);
        break;

      case 'balance':
        await this.handleBalanceCallback(ctx, params);
        break;

      case 'stats':
        await this.handleStatsCallback(ctx, params);
        break;

      case 'traffic':
        await this.handleTrafficCallback(ctx, params);
        break;

      case 'campaign':
        await this.handleCampaignCallback(ctx, params);
        break;

      case 'withdrawal':
        await this.handleWithdrawalCallback(ctx, params);
        break;

      case 'referral':
        await this.handleReferralCallback(ctx, params);
        break;

      case 'help':
        await this.handleHelpCallback(ctx, params);
        break;

      case 'admin':
        await this.handleAdminCallback(ctx, params);
        break;

      case 'verify':
        await this.handleVerifyCallback(ctx, params);
        break;

      case 'export':
        await this.handleExportCallback(ctx, params);
        break;

      case 'reset':
        await this.handleResetCallback(ctx, params);
        break;

      case 'notifications':
        await this.handleNotificationsCallback(ctx, params);
        break;

      case 'language':
        await this.handleLanguageCallback(ctx, params);
        break;

      case 'command':
        await this.handleCommandCallback(ctx, params);
        break;

      case 'back':
        await this.handleBackCallback(ctx, params);
        break;

      case 'close':
        await this.handleCloseCallback(ctx, params);
        break;

      case 'refresh':
        await this.handleRefreshCallback(ctx, params);
        break;

      default:
        await this.handleUnknownCallback(ctx, action, params);
    }
  }

  /**
   * Handle menu navigation callbacks
   */
  private async handleMenuCallback(ctx: BotContext, params: string[]): Promise<void> {
    if (!params[0]) {
      await ctx.reply('❌ Invalid menu selection.');

      return;
    }

    const menuType = params[0] as MenuType;
    await this.menuHandler.navigateToMenu(ctx, menuType);
  }

  /**
   * Handle authentication callbacks
   */
  private async handleAuthCallback(ctx: BotContext, params: string[]): Promise<void> {
    const [subAction] = params;
    const userId = ctx.from?.id?.toString();

    if (!userId) {
      await ctx.reply('❌ Authentication information unavailable.');

      return;
    }

    switch (subAction) {
      case 'register':
        await this.processUserRegistration(ctx);
        break;

      case 'start':
        // Trigger start command equivalent
        await ctx.reply('Welcome to MotivBuy! Please use /start to begin.', {
          reply_markup: {
            inline_keyboard: [[{ text: '🚀 Start', callback_data: 'command:start' }]],
          },
        });

        break;

      case 'logout':
        await this.processUserLogout(ctx);
        break;

      default:
        await ctx.reply(`❌ Authentication action "${subAction}" not available.`);
    }
  }

  /**
   * Handle profile-related callbacks
   */
  private async handleProfileCallback(ctx: BotContext, params: string[]): Promise<void> {
    const [subAction] = params;
    const userId = ctx.from?.id?.toString();

    if (!userId) {
      await ctx.reply('🔒 Authentication required for profile actions.');

      return;
    }

    switch (subAction) {
      case 'edit':
        await ctx.reply(
          '📝 Profile editing is coming soon!\n\nFor now, you can update basic information through account settings.',
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '⚙️ Settings', callback_data: 'menu:settings' },
                  { text: '⬅️ Back', callback_data: 'menu:profile' },
                ],
              ],
            },
          },
        );

        break;

      case 'stats':
        await this.displayProfileStats(ctx);
        break;

      case 'security':
        await ctx.reply('🔒 Security Settings\n\nConfigure your account security options:', {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔑 Change Password', callback_data: 'profile:password' },
                { text: '📧 Email Security', callback_data: 'profile:email_security' },
              ],
              [
                { text: '📱 Two-Factor Auth', callback_data: 'profile:2fa' },
                { text: '🔐 Login History', callback_data: 'profile:login_history' },
              ],
              [{ text: '⬅️ Back', callback_data: 'menu:profile' }],
            ],
          },
        });

        break;

      default:
        await ctx.reply(`❌ Profile action "${subAction}" not available yet.`);
    }
  }

  /**
   * Handle settings callbacks
   */
  private async handleSettingsCallback(ctx: BotContext, params: string[]): Promise<void> {
    const [subAction] = params;
    const userId = ctx.from?.id?.toString();

    if (!userId) {
      await ctx.reply('🔒 Authentication required for settings.');

      return;
    }

    switch (subAction) {
      case 'notifications':
        await this.displayNotificationSettings(ctx);
        break;

      case 'language':
        await this.displayLanguageSettings(ctx);
        break;

      case 'theme':
        await this.displayThemeSettings(ctx);
        break;

      case 'privacy':
        await this.displayPrivacySettings(ctx);
        break;

      case 'export':
        await this.menuHandler.navigateToMenu(ctx, MenuType.Settings);
        await ctx.reply('📥 Data export feature will be available soon!');
        break;

      case 'reset':
        await this.displayResetOptions(ctx);
        break;

      default:
        await ctx.reply(`❌ Settings action "${subAction}" not available yet.`);
    }
  }

  /**
   * Handle balance-related callbacks
   */
  private async handleBalanceCallback(ctx: BotContext, params: string[]): Promise<void> {
    const [subAction] = params;
    const userId = ctx.from?.id?.toString();

    if (!userId) {
      await ctx.reply('🔒 Authentication required for balance information.');

      return;
    }

    switch (subAction) {
      case 'current':
        await this.refreshBalanceDisplay(ctx);
        break;

      case 'history':
        await ctx.reply('📈 Transaction History\n\nTransaction history will be available soon!', {
          reply_markup: {
            inline_keyboard: [[{ text: '⬅️ Back to Balance', callback_data: 'menu:balance' }]],
          },
        });

        break;

      case 'analytics':
        await ctx.reply('📊 Balance Analytics\n\nDetailed balance analytics coming soon!', {
          reply_markup: {
            inline_keyboard: [[{ text: '⬅️ Back to Balance', callback_data: 'menu:balance' }]],
          },
        });

        break;

      default:
        await ctx.reply(`❌ Balance action "${subAction}" not available yet.`);
    }
  }

  /**
   * Handle help callbacks
   */
  private async handleHelpCallback(ctx: BotContext, params: string[]): Promise<void> {
    const [subAction] = params;

    switch (subAction) {
      case 'faq':
        await this.displayFAQ(ctx);
        break;

      case 'contact':
        await ctx.reply('📞 Contact Support\n\nGet help from our support team:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💬 Telegram Support', url: 'https://t.me/motivbuy_support' }],
              [{ text: '📧 Email Support', url: 'mailto:support@motivbuy.com' }],
              [
                { text: '🐛 Report Bug', callback_data: 'help:bug_report' },
                { text: '💡 Feature Request', callback_data: 'help:feature_request' },
              ],
              [{ text: '⬅️ Back', callback_data: 'menu:help' }],
            ],
          },
        });

        break;

      case 'tutorials':
        await ctx.reply('📚 Tutorials & Guides\n\nLearn how to use MotivBuy effectively:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚀 Getting Started', callback_data: 'help:tutorial:getting_started' }],
              [
                { text: '💰 Managing Balance', callback_data: 'help:tutorial:balance' },
                { text: '📈 Analytics Guide', callback_data: 'help:tutorial:analytics' },
              ],
              [
                { text: '🎯 Traffic Sources', callback_data: 'help:tutorial:traffic' },
                { text: '📋 Campaigns', callback_data: 'help:tutorial:campaigns' },
              ],
              [{ text: '⬅️ Back', callback_data: 'menu:help' }],
            ],
          },
        });

        break;

      case 'updates':
        await ctx.reply(
          "📢 Recent Updates\n\n🎉 What's New:\n• Enhanced menu navigation\n• Improved error handling\n• Better session management\n• Performance optimizations\n\n📅 Version 1.0.0 - Released today",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📝 Full Changelog', callback_data: 'help:changelog' },
                  { text: '🔔 Subscribe to Updates', callback_data: 'help:subscribe_updates' },
                ],
                [{ text: '⬅️ Back', callback_data: 'menu:help' }],
              ],
            },
          },
        );

        break;

      default:
        await ctx.reply(`❌ Help section "${subAction}" not available yet.`);
    }
  }

  /**
   * Handle various other callback types
   */
  private async handleStatsCallback(ctx: BotContext, _params: string[]): Promise<void> {
    await ctx.reply('📊 Statistics feature coming soon!');
  }

  private async handleTrafficCallback(ctx: BotContext, _params: string[]): Promise<void> {
    await ctx.reply('🎯 Traffic management coming soon!');
  }

  private async handleCampaignCallback(ctx: BotContext, _params: string[]): Promise<void> {
    await ctx.reply('📋 Campaign management coming soon!');
  }

  private async handleWithdrawalCallback(ctx: BotContext, _params: string[]): Promise<void> {
    await ctx.reply('💸 Withdrawal system coming soon!');
  }

  private async handleReferralCallback(ctx: BotContext, _params: string[]): Promise<void> {
    await ctx.reply('🤝 Referral program coming soon!');
  }

  private async handleAdminCallback(ctx: BotContext, _params: string[]): Promise<void> {
    await ctx.reply('🔧 Admin panel access restricted.');
  }

  private async handleVerifyCallback(ctx: BotContext, _params: string[]): Promise<void> {
    await ctx.reply('✅ Verification system coming soon!');
  }

  private async handleExportCallback(ctx: BotContext, _params: string[]): Promise<void> {
    await ctx.reply('📥 Data export coming soon!');
  }

  private async handleResetCallback(ctx: BotContext, params: string[]): Promise<void> {
    const [subAction] = params;
    const userId = ctx.from?.id?.toString();

    if (!userId) {
      await ctx.reply('🔒 Authentication required.');

      return;
    }

    switch (subAction) {
      case 'session':
        await this.resetUserSession(ctx);
        break;
      case 'notifications':
        await this.resetNotificationSettings(ctx);
        break;
      case 'preferences':
        await this.resetUserPreferences(ctx);
        break;
      case 'cache':
        await this.clearUserCache(ctx);
        break;
      default:
        await ctx.reply(`❌ Reset option "${subAction}" not available.`);
    }
  }

  private async handleNotificationsCallback(ctx: BotContext, _params: string[]): Promise<void> {
    await ctx.reply('🔔 Notification settings coming soon!');
  }

  private async handleLanguageCallback(ctx: BotContext, params: string[]): Promise<void> {
    const [language] = params;
    const userId = ctx.from?.id?.toString();

    if (!userId || !language) {
      await ctx.reply('❌ Invalid language selection.');

      return;
    }

    await this.updateUserLanguage(ctx, language);
  }

  private async handleCommandCallback(ctx: BotContext, params: string[]): Promise<void> {
    const [command] = params;
    await ctx.reply(`Executing command: /${command}\n\nPlease use the actual /${command} command instead.`);
  }

  private async handleBackCallback(ctx: BotContext, _params: string[]): Promise<void> {
    await this.menuHandler.goBack(ctx);
  }

  private async handleCloseCallback(ctx: BotContext, _params: string[]): Promise<void> {
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
      await ctx.reply('Menu closed. Use /menu to open the main menu again.');
    } catch {
      await ctx.reply('Menu closed. Use /menu to open the main menu again.');
    }
  }

  private async handleRefreshCallback(ctx: BotContext, _params: string[]): Promise<void> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      await ctx.reply('🔒 Authentication required.');

      return;
    }

    const navigation = await this.menuHandler.getMenuNavigation(userId);
    const currentMenu = navigation?.currentMenu || MenuType.Main;

    await this.menuHandler.navigateToMenu(ctx, currentMenu);
    await ctx.answerCallbackQuery('🔄 Menu refreshed');
  }

  private async handleUnknownCallback(ctx: BotContext, action: string, params: string[]): Promise<void> {
    this.logger.warn(`Unknown callback action: ${action}`, {
      userId: ctx.from?.id,
      action,
      params,
    });

    await ctx.reply(`❌ Unknown action: "${action}"\n\nThis feature may not be implemented yet.`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📋 Main Menu', callback_data: 'menu:main' },
            { text: '🆘 Support', callback_data: 'help:contact' },
          ],
        ],
      },
    });
  }

  // Helper methods for specific callback processing

  /**
   * Process user registration
   */
  private async processUserRegistration(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id?.toString();
    if (!userId || !ctx.from) {
      await ctx.reply('❌ Registration failed - user information not available.');

      return;
    }

    try {
      this.logger.debug(`Processing user registration for user: ${userId}`);

      // Check if user already exists
      const existingUser = await this.authUserService.findByPlatformId(userId);
      if (existingUser) {
        await ctx.reply('✅ You are already registered! Welcome back.');
        await this.menuHandler.navigateToMenu(ctx, MenuType.Main);

        return;
      }

      // Register new user through auth service
      const authResult = await this.authService.auth({
        userData: {
          id: userId,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          username: ctx.from.username,
          languageCode: ctx.from.language_code,
        },
        platformType: PlatformType.TelegramBot,
        ip: '0.0.0.0', // Bot doesn't have IP info
      });

      if (authResult.ok) {
        await ctx.reply(
          '✅ Registration completed successfully!\n\n' +
            'Your account has been created and you can now:\n' +
            '• Track your campaigns\n' +
            '• Monitor your balance\n' +
            '• Manage traffic sources\n' +
            '• Access detailed analytics\n\n' +
            "Let's get started!",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📋 Main Menu', callback_data: 'menu:main' },
                  { text: '👤 Profile', callback_data: 'menu:profile' },
                ],
                [{ text: '❓ Help', callback_data: 'menu:help' }],
              ],
            },
          },
        );

        // Create initial session
        await this.sessionService.createSession(userId, {
          conversationState: {
            currentStep: 'registered',
            availableSteps: ['main_menu'],
            context: { justRegistered: true },
            isActive: true,
            startedAt: new Date(),
          },
        });
      } else {
        await ctx.reply('❌ Registration failed. Please try again later or contact support if the problem persists.', {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔄 Try Again', callback_data: 'auth:register' },
                { text: '🆘 Support', callback_data: 'help:contact' },
              ],
            ],
          },
        });
      }
    } catch (err: unknown) {
      this.logger.error('Registration error', {
        error: unknownToError(err),
        userId,
      });

      await ctx.reply('❌ Registration failed due to a technical error. Please try again later.', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Try Again', callback_data: 'auth:register' },
              { text: '🆘 Support', callback_data: 'help:contact' },
            ],
          ],
        },
      });
    }
  }

  /**
   * Process user logout
   */
  private async processUserLogout(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return;
    }

    try {
      // Clear user session
      await this.sessionService.deleteSession(userId);

      await ctx.reply('👋 You have been logged out successfully.\n\nUse /start to begin again.', {
        reply_markup: {
          inline_keyboard: [[{ text: '🚀 Start Over', callback_data: 'auth:start' }]],
        },
      });
    } catch (err: unknown) {
      this.logger.error('Logout error', {
        error: unknownToError(err),
        userId,
      });

      await ctx.reply('❌ Logout failed. Please try again.');
    }
  }

  /**
   * Display profile statistics
   */
  private async displayProfileStats(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return;
    }

    try {
      const user = await this.authUserService.findByPlatformId(userId);
      if (!user) {
        await ctx.reply('❌ User profile not found.');

        return;
      }

      const balance = await this.balanceService.getBalance(user.id);
      const membershipDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));

      const statsText = `
📊 <b>Profile Statistics</b>

👤 <b>Account Info:</b>
• Name: ${user.firstName} ${user.lastName || ''}
• Username: ${user.username || 'Not set'}
• Member for: ${membershipDays} days
• Status: ${user.isActive ? '✅ Active' : '❌ Inactive'}
• Verified: ${user.isVerified ? '✅ Yes' : '❌ No'}

💰 <b>Financial Summary:</b>
• Current Balance: $${balance.availableAmount.toFixed(2)}
• Total Earned: $${balance.totalEarned.toFixed(2)}
• Pending Amount: $${balance.pendingAmount.toFixed(2)}

🎯 <b>Activity Summary:</b>
• Total Campaigns: 0
• Active Traffic Sources: 0
• Total Clicks: 0
• Conversion Rate: 0%

<i>Last updated: ${new Date().toLocaleString()}</i>
`;

      await ctx.replyWithHTML(statsText, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Refresh', callback_data: 'profile:stats' },
              { text: '📈 Detailed Stats', callback_data: 'menu:statistics' },
            ],
            [{ text: '⬅️ Back', callback_data: 'menu:profile' }],
          ],
        },
      });
    } catch (err: unknown) {
      this.logger.error('Error displaying profile stats', {
        error: unknownToError(err),
        userId,
      });

      await ctx.reply('❌ Unable to load profile statistics. Please try again later.');
    }
  }

  /**
   * Display notification settings
   */
  private async displayNotificationSettings(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return;
    }

    const session = await this.sessionService.getSession(userId);
    const notifications = session?.data.preferences?.notifications;

    const settingsText = `
🔔 <b>Notification Settings</b>

<b>Current Settings:</b>
• Push Notifications: ${notifications?.enablePush ? '✅ Enabled' : '❌ Disabled'}
• Email Notifications: ${notifications?.enableEmail ? '✅ Enabled' : '❌ Disabled'}
• SMS Notifications: ${notifications?.enableSms ? '✅ Enabled' : '❌ Disabled'}

<b>Notification Categories:</b>
• Balance Updates: ${notifications?.categories?.balance ? '✅' : '❌'}
• Campaign Alerts: ${notifications?.categories?.campaigns ? '✅' : '❌'}
• Traffic Alerts: ${notifications?.categories?.traffic ? '✅' : '❌'}
• Security Alerts: ${notifications?.categories?.security ? '✅' : '❌'}

Configure your notification preferences below:
`;

    await ctx.replyWithHTML(settingsText, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: notifications?.enablePush ? '🔕 Disable Push' : '🔔 Enable Push',
              callback_data: 'notifications:toggle:push',
            },
          ],
          [
            {
              text: notifications?.enableEmail ? '📧❌ Disable Email' : '📧✅ Enable Email',
              callback_data: 'notifications:toggle:email',
            },
            {
              text: notifications?.enableSms ? '📱❌ Disable SMS' : '📱✅ Enable SMS',
              callback_data: 'notifications:toggle:sms',
            },
          ],
          [{ text: '⚙️ Advanced Settings', callback_data: 'notifications:advanced' }],
          [{ text: '⬅️ Back', callback_data: 'menu:settings' }],
        ],
      },
    });
  }

  /**
   * Display language settings
   */
  private async displayLanguageSettings(ctx: BotContext): Promise<void> {
    const session = await this.sessionService.getSession(ctx.from?.id?.toString() || '');
    const currentLanguage = session?.data.preferences?.language || 'en';

    const languageNames: Record<string, string> = {
      en: 'English',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
      ru: 'Русский',
      zh: '中文',
    };

    const settingsText = `
🌍 <b>Language Settings</b>

<b>Current Language:</b> ${languageNames[currentLanguage]} (${currentLanguage})

Select your preferred language:
`;

    await ctx.replyWithHTML(settingsText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: currentLanguage === 'en' ? '✅ English' : '🇺🇸 English', callback_data: 'language:en' },
            { text: currentLanguage === 'es' ? '✅ Español' : '🇪🇸 Español', callback_data: 'language:es' },
          ],
          [
            { text: currentLanguage === 'fr' ? '✅ Français' : '🇫🇷 Français', callback_data: 'language:fr' },
            { text: currentLanguage === 'de' ? '✅ Deutsch' : '🇩🇪 Deutsch', callback_data: 'language:de' },
          ],
          [
            { text: currentLanguage === 'ru' ? '✅ Русский' : '🇷🇺 Русский', callback_data: 'language:ru' },
            { text: currentLanguage === 'zh' ? '✅ 中文' : '🇨🇳 中文', callback_data: 'language:zh' },
          ],
          [{ text: '⬅️ Back', callback_data: 'menu:settings' }],
        ],
      },
    });
  }

  /**
   * Display theme settings
   */
  private async displayThemeSettings(ctx: BotContext): Promise<void> {
    await ctx.reply(
      '🎨 Theme Settings\n\nTheme customization is coming soon!\n\nFor now, the bot automatically adapts to your Telegram theme.',
      {
        reply_markup: {
          inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'menu:settings' }]],
        },
      },
    );
  }

  /**
   * Display privacy settings
   */
  private async displayPrivacySettings(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return;
    }

    const session = await this.sessionService.getSession(userId);
    const privacy = session?.data.preferences?.privacy;

    const settingsText = `
🔒 <b>Privacy Settings</b>

<b>Data Sharing Preferences:</b>
• Analytics Sharing: ${privacy?.shareAnalytics ? '✅ Enabled' : '❌ Disabled'}
• Usage Data: ${privacy?.shareUsageData ? '✅ Enabled' : '❌ Disabled'}
• Data Export: ${privacy?.allowDataExport ? '✅ Enabled' : '❌ Disabled'}

<b>Privacy Information:</b>
• Your data is encrypted and secure
• We never sell your personal information
• You control what data is shared
• You can request data deletion anytime

Manage your privacy preferences:
`;

    await ctx.replyWithHTML(settingsText, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: privacy?.shareAnalytics ? '📊❌ Disable Analytics' : '📊✅ Enable Analytics',
              callback_data: 'privacy:toggle:analytics',
            },
          ],
          [
            {
              text: privacy?.shareUsageData ? '📈❌ Disable Usage Data' : '📈✅ Enable Usage Data',
              callback_data: 'privacy:toggle:usage',
            },
          ],
          [
            { text: '📥 Download My Data', callback_data: 'privacy:download' },
            { text: '🗑️ Delete My Data', callback_data: 'privacy:delete' },
          ],
          [
            { text: '📄 Privacy Policy', url: 'https://motivbuy.com/privacy' },
            { text: '📋 Terms of Service', url: 'https://motivbuy.com/terms' },
          ],
          [{ text: '⬅️ Back', callback_data: 'menu:settings' }],
        ],
      },
    });
  }

  /**
   * Display reset options
   */
  private async displayResetOptions(ctx: BotContext): Promise<void> {
    await ctx.reply(
      '🔄 <b>Reset Options</b>\n\n⚠️ <b>WARNING:</b> These actions cannot be undone.\n\nChoose what you want to reset:',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🗂️ Session Data', callback_data: 'reset:session' },
              { text: '🔔 Notifications', callback_data: 'reset:notifications' },
            ],
            [
              { text: '⚙️ Preferences', callback_data: 'reset:preferences' },
              { text: '🧹 Cache', callback_data: 'reset:cache' },
            ],
            [{ text: '❌ Cancel', callback_data: 'menu:settings' }],
          ],
        },
        parse_mode: 'HTML',
      },
    );
  }

  /**
   * Display FAQ
   */
  private async displayFAQ(ctx: BotContext): Promise<void> {
    const faqText = `
📚 <b>Frequently Asked Questions</b>

<b>❓ How do I track my campaigns?</b>
Use the Statistics menu to view detailed performance metrics and analytics for all your campaigns.

<b>❓ When can I withdraw my earnings?</b>
You can request withdrawals once you have a minimum balance of $10.00. Processing usually takes 1-3 business days.

<b>❓ How do I add traffic sources?</b>
Go to the Traffic menu and use the "Add Source" option to configure new traffic channels.

<b>❓ Is my data secure?</b>
Yes! We use industry-standard encryption and never share your personal information with third parties.

<b>❓ How do I get support?</b>
Contact us via @motivbuy_support on Telegram or email support@motivbuy.com

<b>❓ Can I use multiple devices?</b>
Your account is linked to your Telegram ID and accessible from any device where you're logged into Telegram.

<b>❓ How often are statistics updated?</b>
Statistics are updated in real-time as traffic and conversions occur.
`;

    await ctx.replyWithHTML(faqText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💬 Contact Support', callback_data: 'help:contact' },
            { text: '📖 More Help', callback_data: 'help:tutorials' },
          ],
          [{ text: '⬅️ Back', callback_data: 'menu:help' }],
        ],
      },
    });
  }

  /**
   * Refresh balance display
   */
  private async refreshBalanceDisplay(ctx: BotContext): Promise<void> {
    await this.menuHandler.navigateToMenu(ctx, MenuType.Balance);
  }

  // Reset and utility methods

  private async resetUserSession(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return;
    }

    await this.sessionService.deleteSession(userId);
    await this.sessionService.createSession(userId);

    await ctx.reply('🗂️ Session data has been reset successfully.');
  }

  private async resetNotificationSettings(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return;
    }

    await this.sessionService.updateSession(userId, {
      preferences: {
        notifications: {
          enablePush: true,
          enableEmail: false,
          enableSms: false,
          categories: {},
        },
      },
    });

    await ctx.reply('🔔 Notification settings have been reset to defaults.');
  }

  private async resetUserPreferences(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return;
    }

    await this.sessionService.updateSession(userId, {
      preferences: {
        language: 'en',
        notifications: {
          enablePush: true,
          enableEmail: false,
          enableSms: false,
          categories: {},
        },
        display: {
          theme: 'auto',
          timezone: 'UTC',
          dateFormat: 'DD/MM/YYYY',
          numberFormat: 'en-US',
        },
        privacy: {
          shareAnalytics: true,
          shareUsageData: true,
          allowDataExport: true,
        },
      },
    });

    await ctx.reply('⚙️ All preferences have been reset to defaults.');
  }

  private async clearUserCache(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return;
    }

    await this.sessionService.updateSession(userId, {
      cache: {},
      formData: {},
    });

    await ctx.reply('🧹 Cache has been cleared successfully.');
  }

  private async updateUserLanguage(ctx: BotContext, language: string): Promise<void> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return;
    }

    await this.sessionService.updateSession(userId, {
      preferences: {
        language,
      },
    });

    const languageNames: Record<string, string> = {
      en: 'English',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
      ru: 'Русский',
      zh: '中文',
    };

    await ctx.reply(`🌍 Language changed to ${languageNames[language] || language}`);
  }

  /**
   * Update callback activity in session
   */
  private async updateCallbackActivity(userId: string, callbackData: string): Promise<void> {
    try {
      await this.sessionService.updateSession(userId, {
        conversationState: {
          currentStep: `callback_${callbackData.split(':')[0]}`,
          context: {
            lastCallback: callbackData,
            lastCallbackAt: new Date().toISOString(),
          },
          isActive: true,
        },
      });
    } catch (err: unknown) {
      this.logger.error('Failed to update callback activity', {
        userId,
        callbackData,
        error: unknownToError(err),
      });
    }
  }

  /**
   * Handle callback processing errors
   */
  private async handleCallbackError(ctx: BotContext, error: Error): Promise<void> {
    const userId = ctx.from?.id;

    this.logger.error('Callback processing error', {
      userId,
      error: error.message,
      stack: error.stack,
      callbackData: ctx.callbackQuery?.data,
    });

    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? `Callback error: ${error.message}`
        : 'Sorry, something went wrong. Please try again or return to the main menu.';

    try {
      await ctx.reply(errorMessage, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 Main Menu', callback_data: 'menu:main' },
              { text: '🆘 Support', callback_data: 'help:contact' },
            ],
          ],
        },
      });
    } catch (replyError) {
      this.logger.error('Failed to send callback error message', {
        originalError: error.message,
        replyError: replyError instanceof Error ? replyError.message : String(replyError),
        userId,
      });
    }
  }
}
