import { unknownToError } from '@app/common-shared';
import { Injectable, Logger } from '@nestjs/common';
import { Composer, InlineKeyboard } from 'grammy';
import { BotContext, CallbackUtil, MenuButton, MenuConfig, MenuType } from '@app/feature-bot-shared';
import { SessionService } from '../service/session.service';
import { AuthService } from '@app/feature-auth-main';
import { AuthUserService } from '@app/feature-auth-shared';
import { UserService } from '@app/feature-user-main';
import { PlatformType, UserEntity } from '@app/database';

/**
 * Authentication State Enum
 */
enum AuthState {
  Unauthenticated = 'unauthenticated',
  LoginFlow = 'login_flow',
  RegisterFlow = 'register_flow',
  VerificationFlow = 'verification_flow',
  ProfileSetup = 'profile_setup',
  Authenticated = 'authenticated',
}

/**
 * Verification Type Enum
 */
enum VerificationType {
  Email = 'email',
  Phone = 'phone',
  Document = 'document',
}

/**
 * Auth Composer
 *
 * Grammy-based composer for authentication UI composition and user flows.
 * Handles login, registration, verification, and profile management interfaces
 * using Grammy's Composer patterns with comprehensive state management.
 *
 * @class AuthComposer
 */
@Injectable()
export class AuthComposer {
  private readonly logger = new Logger(AuthComposer.name);
  private composer: Composer<BotContext>;

  constructor(
    private readonly sessionService: SessionService,
    private readonly authService: AuthService,
    private readonly authUserService: AuthUserService,
    private readonly userService: UserService,
  ) {
    this.composer = new Composer<BotContext>();
    this.setupComposer();
  }

  /**
   * Get the Grammy composer instance
   *
   * @returns Composer<BotContext> - Grammy composer instance
   */
  getComposer(): Composer<BotContext> {
    return this.composer;
  }

  /**
   * Compose authentication gateway menu
   *
   * @param ctx - Bot context
   * @returns Promise<MenuConfig> - Auth gateway menu configuration
   */
  async composeAuthGateway(ctx: BotContext): Promise<MenuConfig> {
    const userId = ctx.from?.id?.toString();
    this.logger.debug(`Composing auth gateway for user: ${userId}`);

    try {
      // Check current authentication state
      const authState = await this.getCurrentAuthState(ctx);

      switch (authState) {
        case AuthState.Authenticated:
          return await this.composeAuthenticatedMenu(ctx);
        case AuthState.LoginFlow:
          return await this.composeLoginMenu(ctx);
        case AuthState.RegisterFlow:
          return await this.composeRegistrationMenu(ctx);
        case AuthState.VerificationFlow:
          return await this.composeVerificationMenu(ctx, VerificationType.Email);
        case AuthState.ProfileSetup:
          return await this.composePostAuthMenu(ctx, true);
        default:
          return await this.composeWelcomeMenu(ctx);
      }
    } catch (err: unknown) {
      this.logger.error('Error composing auth gateway', {
        error: unknownToError(err),
        userId,
      });

      return this.getDefaultAuthMenu(ctx);
    }
  }

  /**
   * Compose welcome menu for new users
   *
   * @param ctx - Bot context
   * @returns Promise<MenuConfig> - Welcome menu configuration
   */
  async composeWelcomeMenu(ctx: BotContext): Promise<MenuConfig> {
    const userName = ctx.from?.first_name || 'User';

    return {
      type: MenuType.Auth,
      title: `Welcome to MotivBuy, ${userName}! 👋`,
      description: 'Get started by creating your account or logging in if you already have one.',
      buttons: [
        [
          {
            text: '🚀 Quick Start (Recommended)',
            callbackData: CallbackUtil.createActionCallback('auth', 'quick_register'),
            metadata: { priority: 'high', recommended: true },
          },
        ],
        [
          {
            text: '📝 Create Account',
            callbackData: CallbackUtil.createActionCallback('auth', 'register'),
            metadata: { action: 'register' },
          },
          {
            text: '🔐 Login',
            callbackData: CallbackUtil.createActionCallback('auth', 'login'),
            metadata: { action: 'login' },
          },
        ],
        [
          {
            text: '❓ What is MotivBuy?',
            callbackData: CallbackUtil.createActionCallback('auth', 'about'),
            metadata: { action: 'information' },
          },
        ],
        [
          {
            text: '🆘 Need Help?',
            callbackData: CallbackUtil.createActionCallback('auth', 'help'),
            metadata: { action: 'support' },
          },
        ],
      ],
      isInline: true,
      metadata: {
        flowType: 'welcome',
        userName,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Compose login menu
   *
   * @param ctx - Bot context
   * @returns Promise<MenuConfig> - Login menu configuration
   */
  async composeLoginMenu(ctx: BotContext): Promise<MenuConfig> {
    this.logger.debug(`Composing login menu for user: ${ctx.from?.id}`);

    // Check if user already exists
    const userId = ctx.from?.id?.toString();
    const existingUser = userId ? await this.authUserService.findByPlatformId(userId) : null;

    if (existingUser) {
      return await this.composeWelcomeBackMenu(ctx, existingUser);
    }

    return {
      type: MenuType.Auth,
      title: '🔐 Login to Your Account',
      description: 'Choose your preferred login method:',
      buttons: [
        [
          {
            text: '📱 Login with Telegram',
            callbackData: CallbackUtil.createActionCallback('auth', 'login_telegram'),
            metadata: { method: 'telegram', recommended: true },
          },
        ],
        [
          {
            text: '📧 Login with Email',
            callbackData: CallbackUtil.createActionCallback('auth', 'login_email'),
            metadata: { method: 'email' },
          },
        ],
        [
          {
            text: '📞 Login with Phone',
            callbackData: CallbackUtil.createActionCallback('auth', 'login_phone'),
            metadata: { method: 'phone' },
          },
        ],
        [
          {
            text: '🔑 Forgot Password?',
            callbackData: CallbackUtil.createActionCallback('auth', 'forgot_password'),
            metadata: { action: 'recovery' },
          },
        ],
        [
          {
            text: '👤 Create Account Instead',
            callbackData: CallbackUtil.createActionCallback('auth', 'register'),
            metadata: { action: 'switch_to_register' },
          },
        ],
        [
          {
            text: '◀️ Back to Welcome',
            callbackData: CallbackUtil.createActionCallback('auth', 'start'),
            metadata: { action: 'navigation' },
          },
        ],
      ],
      isInline: true,
      metadata: {
        flowType: 'login',
        hasExistingUser: !!existingUser,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Compose registration menu
   *
   * @param ctx - Bot context
   * @returns Promise<MenuConfig> - Registration menu configuration
   */
  async composeRegistrationMenu(ctx: BotContext): Promise<MenuConfig> {
    this.logger.debug(`Composing registration menu for user: ${ctx.from?.id}`);

    const userId = ctx.from?.id?.toString();
    const existingUser = userId ? await this.authUserService.findByPlatformId(userId) : null;

    if (existingUser) {
      return await this.composeAlreadyRegisteredMenu(ctx, existingUser);
    }

    return {
      type: MenuType.Auth,
      title: '📝 Create Your Account',
      description: 'Join MotivBuy and start earning today! Choose your registration method:',
      buttons: [
        [
          {
            text: '🚀 Quick Registration',
            callbackData: CallbackUtil.createActionCallback('auth', 'quick_register'),
            metadata: { method: 'quick', recommended: true },
          },
        ],
        [
          {
            text: '📱 Register with Telegram',
            callbackData: CallbackUtil.createActionCallback('auth', 'register_telegram'),
            metadata: { method: 'telegram' },
          },
        ],
        [
          {
            text: '📧 Register with Email',
            callbackData: CallbackUtil.createActionCallback('auth', 'register_email'),
            metadata: { method: 'email' },
          },
        ],
        [
          {
            text: '📞 Register with Phone',
            callbackData: CallbackUtil.createActionCallback('auth', 'register_phone'),
            metadata: { method: 'phone' },
          },
        ],
        [
          {
            text: '🎁 Have a Referral Code?',
            callbackData: CallbackUtil.createActionCallback('auth', 'referral_code'),
            metadata: { action: 'referral' },
          },
        ],
        [
          {
            text: '🔐 Already have an account?',
            callbackData: CallbackUtil.createActionCallback('auth', 'login'),
            metadata: { action: 'switch_to_login' },
          },
        ],
        [
          {
            text: '◀️ Back to Welcome',
            callbackData: CallbackUtil.createActionCallback('auth', 'start'),
            metadata: { action: 'navigation' },
          },
        ],
      ],
      isInline: true,
      metadata: {
        flowType: 'registration',
        hasExistingUser: !!existingUser,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Compose verification menu
   *
   * @param ctx - Bot context
   * @param verificationType - Type of verification
   * @returns Promise<MenuConfig> - Verification menu configuration
   */
  async composeVerificationMenu(ctx: BotContext, verificationType: VerificationType): Promise<MenuConfig> {
    this.logger.debug(`Composing verification menu for user: ${ctx.from?.id}, type: ${verificationType}`);

    const typeIcons: Record<VerificationType, string> = {
      [VerificationType.Email]: '📧',
      [VerificationType.Phone]: '📱',
      [VerificationType.Document]: '📄',
    };

    const typeLabels: Record<VerificationType, string> = {
      [VerificationType.Email]: 'Email',
      [VerificationType.Phone]: 'Phone',
      [VerificationType.Document]: 'Document',
    };

    const icon = typeIcons[verificationType];
    const label = typeLabels[verificationType];

    // Get user session to check verification state
    const userId = ctx.from?.id?.toString();
    const session = userId ? await this.sessionService.getSession(userId) : null;
    const verificationAttempts = (session?.data.cache?.verificationAttempts as number | undefined) || 0;

    return {
      type: MenuType.Auth,
      title: `${icon} ${label} Verification`,
      description: `Please verify your ${label.toLowerCase()} to complete your account setup.`,
      buttons: [
        [
          {
            text: '✅ I Entered the Code',
            callbackData: CallbackUtil.createActionCallback('auth', `verify_${verificationType}`),
            metadata: { action: 'verify', type: verificationType },
          },
        ],
        [
          {
            text: '🔄 Resend Code',
            callbackData: CallbackUtil.createActionCallback('auth', `resend_${verificationType}`),
            metadata: { action: 'resend', type: verificationType },
            disabled: verificationAttempts >= 3,
          },
        ],
        [
          {
            text: '✏️ Change Method',
            callbackData: CallbackUtil.createActionCallback('auth', `change_${verificationType}`),
            metadata: { action: 'change_method', type: verificationType },
          },
        ],
        [
          {
            text: '⏭️ Skip for Now',
            callbackData: CallbackUtil.createActionCallback('auth', 'skip_verification'),
            metadata: { action: 'skip' },
          },
          {
            text: '❓ Help',
            callbackData: CallbackUtil.createActionCallback('auth', 'verification_help'),
            metadata: { action: 'help' },
          },
        ],
        [
          {
            text: '◀️ Back to Registration',
            callbackData: CallbackUtil.createActionCallback('auth', 'register'),
            metadata: { action: 'navigation' },
          },
        ],
      ],
      isInline: true,
      metadata: {
        flowType: 'verification',
        verificationType,
        attempts: verificationAttempts,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Compose post-authentication success menu
   *
   * @param ctx - Bot context
   * @param isFirstLogin - Whether this is user's first login
   * @returns Promise<MenuConfig> - Post-auth success menu
   */
  async composePostAuthMenu(ctx: BotContext, isFirstLogin = false): Promise<MenuConfig> {
    this.logger.debug(`Composing post-auth menu for user: ${ctx.from?.id}, firstLogin: ${isFirstLogin}`);

    const userName = ctx.from?.first_name || 'User';
    const title = isFirstLogin ? `🎉 Welcome to MotivBuy, ${userName}!` : `✅ Welcome back, ${userName}!`;

    const description = isFirstLogin
      ? "Your account has been created successfully! Let's get you started."
      : "You've successfully logged in. Ready to continue earning?";

    const buttons: MenuButton[][] = [];

    if (isFirstLogin) {
      // First-time user flow
      buttons.push([
        {
          text: '🎯 Quick Setup Guide',
          callbackData: CallbackUtil.createActionCallback('auth', 'profile_setup'),
          metadata: { action: 'setup', priority: 'high' },
        },
      ]);

      buttons.push([
        {
          text: '📖 Tutorial',
          callbackData: CallbackUtil.createActionCallback('auth', 'tutorial'),
          metadata: { action: 'tutorial' },
        },
        {
          text: '⏭️ Skip Tutorial',
          callbackData: CallbackUtil.createActionCallback('auth', 'skip_tutorial'),
          metadata: { action: 'skip' },
        },
      ]);
    } else {
      // Returning user options
      buttons.push([
        {
          text: '📊 View Dashboard',
          callbackData: CallbackUtil.createMenuCallback('statistics'),
          metadata: { action: 'dashboard' },
        },
        {
          text: '💰 Check Balance',
          callbackData: CallbackUtil.createMenuCallback('balance'),
          metadata: { action: 'balance' },
        },
      ]);
    }

    // Common actions for all authenticated users
    buttons.push([
      {
        text: '🏠 Go to Main Menu',
        callbackData: CallbackUtil.createMenuCallback('main'),
        metadata: { action: 'main_menu', priority: 'high' },
      },
    ]);

    if (isFirstLogin) {
      buttons.push([
        {
          text: '🎁 Claim Welcome Bonus',
          callbackData: CallbackUtil.createActionCallback('auth', 'welcome_bonus'),
          metadata: { action: 'bonus', special: true },
        },
      ]);
    }

    return {
      type: MenuType.Auth,
      title,
      description,
      buttons,
      isInline: true,
      metadata: {
        flowType: 'post_auth',
        isFirstLogin,
        userName,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Compose logout confirmation menu
   *
   * @param ctx - Bot context
   * @returns Promise<MenuConfig> - Logout confirmation menu
   */
  async composeLogoutMenu(ctx: BotContext): Promise<MenuConfig> {
    this.logger.debug(`Composing logout menu for user: ${ctx.from?.id}`);

    const userName = ctx.from?.first_name || 'User';

    return {
      type: MenuType.Auth,
      title: `🚪 Logout Confirmation`,
      description: `Are you sure you want to logout, ${userName}? Your data will be saved securely.`,
      buttons: [
        [
          {
            text: '✅ Yes, Logout',
            callbackData: CallbackUtil.createActionCallback('auth', 'confirm_logout'),
            metadata: { action: 'confirm', destructive: true },
          },
          {
            text: '❌ Cancel',
            callbackData: CallbackUtil.createMenuCallback('main'),
            metadata: { action: 'cancel' },
          },
        ],
        [
          {
            text: '🗑️ Logout & Clear Data',
            callbackData: CallbackUtil.createActionCallback('auth', 'logout_clear_data'),
            metadata: { action: 'logout_clear', destructive: true },
          },
        ],
        [
          {
            text: '💾 Export Data First',
            callbackData: CallbackUtil.createActionCallback('auth', 'export_before_logout'),
            metadata: { action: 'export_first' },
          },
        ],
      ],
      isInline: true,
      metadata: {
        flowType: 'logout',
        userName,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Create inline keyboard from menu configuration
   *
   * @param menuConfig - Menu configuration
   * @returns InlineKeyboard - Grammy InlineKeyboard instance
   */
  createInlineKeyboard(menuConfig: MenuConfig): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    menuConfig.buttons.forEach((row, rowIndex) => {
      if (rowIndex > 0) {
        keyboard.row();
      }

      row.forEach((button) => {
        if (button.disabled) {
          return;
        } // Skip disabled buttons

        if (button.url) {
          keyboard.url(button.text, button.url);
        } else {
          keyboard.text(button.text, button.callbackData);
        }
      });
    });

    return keyboard;
  }

  /**
   * Get authentication status message
   *
   * @param isAuthenticated - Whether user is authenticated
   * @param username - User's username (if available)
   * @returns string - Status message
   */
  getAuthStatusMessage(isAuthenticated: boolean, username?: string): string {
    if (isAuthenticated) {
      const userDisplay = username ? `@${username}` : 'User';

      return `✅ Logged in as ${userDisplay}`;
    }

    return '❌ Not authenticated. Please log in to continue.';
  }

  // Grammy composer handlers

  /**
   * Setup Grammy composer with auth-specific handlers
   */
  private setupComposer(): void {
    // Main authentication flows
    this.composer.callbackQuery('auth:start', (ctx) => this.handleAuthStart(ctx));
    this.composer.callbackQuery('auth:login', (ctx) => this.handleLogin(ctx));
    this.composer.callbackQuery('auth:register', (ctx) => this.handleRegister(ctx));
    this.composer.callbackQuery('auth:logout', (ctx) => this.handleLogout(ctx));

    // Registration flow
    this.composer.callbackQuery(/^auth:register_/, (ctx) => this.handleRegistrationFlow(ctx));
    this.composer.callbackQuery('auth:quick_register', (ctx) => this.handleQuickRegister(ctx));
    this.composer.callbackQuery('auth:complete_profile', (ctx) => this.handleCompleteProfile(ctx));

    // Login flow
    this.composer.callbackQuery(/^auth:login_/, (ctx) => this.handleLoginFlow(ctx));
    this.composer.callbackQuery('auth:forgot_password', (ctx) => this.handleForgotPassword(ctx));

    // Verification flow
    this.composer.callbackQuery(/^auth:verify_/, (ctx) => this.handleVerificationFlow(ctx));
    this.composer.callbackQuery(/^auth:resend_/, (ctx) => this.handleResendVerification(ctx));
    this.composer.callbackQuery(/^auth:change_/, (ctx) => this.handleChangeVerificationMethod(ctx));

    // Profile management
    this.composer.callbackQuery('auth:profile_setup', (ctx) => this.handleProfileSetup(ctx));
    this.composer.callbackQuery('auth:tutorial', (ctx) => this.handleTutorial(ctx));
    this.composer.callbackQuery('auth:skip_tutorial', (ctx) => this.handleSkipTutorial(ctx));

    // Account actions
    this.composer.callbackQuery('auth:confirm_logout', (ctx) => this.handleConfirmLogout(ctx));
    this.composer.callbackQuery('auth:delete_account', (ctx) => this.handleDeleteAccount(ctx));
    this.composer.callbackQuery('auth:export_data', (ctx) => this.handleExportData(ctx));

    // Security and settings
    this.composer.callbackQuery('auth:security', (ctx) => this.handleSecurityMenu(ctx));
    this.composer.callbackQuery('auth:privacy', (ctx) => this.handlePrivacySettings(ctx));
    this.composer.callbackQuery('auth:sessions', (ctx) => this.handleSessionManagement(ctx));

    // Help and support
    this.composer.callbackQuery('auth:help', (ctx) => this.handleAuthHelp(ctx));
    this.composer.callbackQuery('auth:contact_support', (ctx) => this.handleContactSupport(ctx));
  }

  /**
   * Handle authentication start
   */
  private async handleAuthStart(ctx: BotContext): Promise<void> {
    try {
      const menuConfig = await this.composeWelcomeMenu(ctx);
      const keyboard = this.createInlineKeyboard(menuConfig);

      const menuText = this.formatMenuText(menuConfig);

      if (ctx.callbackQuery) {
        await ctx.editMessageText(menuText, {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        });

        await ctx.answerCallbackQuery('🎉 Welcome!');
      } else {
        await ctx.replyWithHTML(menuText, { reply_markup: keyboard });
      }

      // Update auth state
      const userId = ctx.from?.id?.toString();
      if (userId) {
        await this.updateAuthState(userId, AuthState.Unauthenticated);
      }
    } catch (err: unknown) {
      this.logger.error('Error handling auth start', {
        error: unknownToError(err),
        userId: ctx.from?.id,
      });

      await ctx.answerCallbackQuery('❌ Failed to start authentication');
    }
  }

  /**
   * Handle login flow
   */
  private async handleLogin(ctx: BotContext): Promise<void> {
    try {
      const menuConfig = await this.composeLoginMenu(ctx);
      const keyboard = this.createInlineKeyboard(menuConfig);

      await ctx.editMessageText(this.formatMenuText(menuConfig), {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery('🔐 Login options');

      const userId = ctx.from?.id?.toString();
      if (userId) {
        await this.updateAuthState(userId, AuthState.LoginFlow);
      }
    } catch (err: unknown) {
      this.logger.error('Error handling login', {
        error: unknownToError(err),
        userId: ctx.from?.id,
      });

      await ctx.answerCallbackQuery('❌ Login failed');
    }
  }

  /**
   * Handle registration flow
   */
  private async handleRegister(ctx: BotContext): Promise<void> {
    try {
      const menuConfig = await this.composeRegistrationMenu(ctx);
      const keyboard = this.createInlineKeyboard(menuConfig);

      await ctx.editMessageText(this.formatMenuText(menuConfig), {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery('📝 Registration options');

      const userId = ctx.from?.id?.toString();
      if (userId) {
        await this.updateAuthState(userId, AuthState.RegisterFlow);
      }
    } catch (err: unknown) {
      this.logger.error('Error handling registration', {
        error: unknownToError(err),
        userId: ctx.from?.id,
      });

      await ctx.answerCallbackQuery('❌ Registration failed');
    }
  }

  /**
   * Handle quick registration
   */
  private async handleQuickRegister(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id?.toString();
    if (!userId || !ctx.from) {
      await ctx.answerCallbackQuery('❌ User information not available');

      return;
    }

    try {
      this.logger.debug(`Processing quick registration for user: ${userId}`);

      // Check if user already exists
      const existingUser = await this.authUserService.findByPlatformId(userId);
      if (existingUser) {
        const welcomeMenu = await this.composeAlreadyRegisteredMenu(ctx, existingUser);
        const keyboard = this.createInlineKeyboard(welcomeMenu);

        await ctx.editMessageText(this.formatMenuText(welcomeMenu), {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        });

        await ctx.answerCallbackQuery('✅ Account already exists');

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
        // Create initial session
        await this.sessionService.createSession(userId, {
          conversationState: {
            currentStep: 'just_registered',
            availableSteps: ['profile_setup', 'tutorial', 'main_menu'],
            context: { justRegistered: true, quickRegister: true },
            isActive: true,
            startedAt: new Date(),
          },
        });

        // Show post-auth menu
        const postAuthMenu = await this.composePostAuthMenu(ctx, true);
        const keyboard = this.createInlineKeyboard(postAuthMenu);

        await ctx.editMessageText(this.formatMenuText(postAuthMenu), {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        });

        await ctx.answerCallbackQuery('🎉 Account created successfully!');

        // Update auth state
        await this.updateAuthState(userId, AuthState.Authenticated);
      } else {
        throw new Error('Authentication failed');
      }
    } catch (err: unknown) {
      this.logger.error('Quick registration error', {
        error: unknownToError(err),
        userId,
      });

      await ctx.reply('❌ Registration failed. Please try again or use manual registration.', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Try Again', callback_data: 'auth:quick_register' },
              { text: '📝 Manual Registration', callback_data: 'auth:register' },
            ],
            [{ text: '🆘 Contact Support', callback_data: 'auth:contact_support' }],
          ],
        },
      });

      await ctx.answerCallbackQuery('❌ Registration failed');
    }
  }

  // Additional handler stubs for comprehensive auth flow

  /**
   * Handle logout confirmation
   */
  private async handleConfirmLogout(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return;
    }

    try {
      // Clear user session
      await this.sessionService.deleteSession(userId);

      // Show logged out message
      await ctx.editMessageText(
        '👋 <b>Successfully Logged Out</b>\n\nThank you for using MotivBuy! Your data has been saved securely.\n\nUse /start to login again anytime.',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🚀 Login Again', callback_data: 'auth:start' },
                { text: '📱 Contact Support', callback_data: 'auth:contact_support' },
              ],
            ],
          },
          parse_mode: 'HTML',
        },
      );

      await ctx.answerCallbackQuery('👋 Logged out successfully');

      // Update auth state
      await this.updateAuthState(userId, AuthState.Unauthenticated);
    } catch (err: unknown) {
      this.logger.error('Logout error', {
        error: unknownToError(err),
        userId,
      });

      await ctx.answerCallbackQuery('❌ Logout failed');
    }
  }

  private async handleRegistrationFlow(ctx: BotContext): Promise<void> {
    const callbackData = ctx.callbackQuery?.data || '';
    const [, method] = callbackData.split('_'); // e.g., register_email -> email

    await ctx.answerCallbackQuery(`📝 ${method} registration selected`);
    // Implement specific registration flow based on method
  }

  private async handleLoginFlow(ctx: BotContext): Promise<void> {
    const callbackData = ctx.callbackQuery?.data || '';
    const [, method] = callbackData.split('_'); // e.g., login_email -> email

    await ctx.answerCallbackQuery(`🔐 ${method} login selected`);
    // Implement specific login flow based on method
  }

  private async handleVerificationFlow(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('📧 Verification processing...');
    // Implement verification logic
  }

  private async handleResendVerification(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('🔄 Verification code resent');
    // Implement resend logic
  }

  private async handleChangeVerificationMethod(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('✏️ Changing verification method...');
    // Implement method change logic
  }

  private async handleProfileSetup(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('🎯 Starting profile setup...');
    // Implement profile setup flow
  }

  private async handleTutorial(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('📖 Starting tutorial...');
    // Implement tutorial flow
  }

  private async handleSkipTutorial(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('⏭️ Tutorial skipped');
    // Navigate to main menu
  }

  private async handleLogout(ctx: BotContext): Promise<void> {
    const menuConfig = await this.composeLogoutMenu(ctx);
    const keyboard = this.createInlineKeyboard(menuConfig);

    await ctx.editMessageText(this.formatMenuText(menuConfig), {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });

    await ctx.answerCallbackQuery('🚪 Logout confirmation');
  }

  private async handleDeleteAccount(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('🗑️ Account deletion - Contact support');
    // Implement account deletion flow
  }

  private async handleExportData(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('📥 Data export started...');
    // Implement data export
  }

  private async handleSecurityMenu(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('🔒 Security settings');
    // Implement security menu
  }

  private async handlePrivacySettings(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('🛡️ Privacy settings');
    // Implement privacy settings
  }

  private async handleSessionManagement(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('📱 Session management');
    // Implement session management
  }

  private async handleAuthHelp(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('❓ Auth help');
    // Implement help system
  }

  private async handleContactSupport(ctx: BotContext): Promise<void> {
    await ctx.reply(
      '🆘 <b>Contact Support</b>\n\nIf you need help with authentication:\n\n• Email: support@motivbuy.com\n• Telegram: @motivbuy_support\n• Response time: Usually within 24 hours',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📧 Email Support', url: 'mailto:support@motivbuy.com' },
              { text: '💬 Telegram Support', url: 'https://t.me/motivbuy_support' },
            ],
            [{ text: '◀️ Back', callback_data: 'auth:start' }],
          ],
        },
      },
    );

    await ctx.answerCallbackQuery('🆘 Support contacts shown');
  }

  private async handleForgotPassword(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('🔑 Password reset - Feature coming soon');
    // Implement password reset
  }

  // Helper methods

  private async handleCompleteProfile(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery('✅ Profile completion');
    // Implement profile completion
  }

  private async getCurrentAuthState(ctx: BotContext): Promise<AuthState> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return AuthState.Unauthenticated;
    }

    try {
      const session = await this.sessionService.getSession(userId);
      const user = await this.authUserService.findByPlatformId(userId);

      if (user && user.isActive) {
        if (session?.data.conversationState?.currentStep === 'just_registered') {
          return AuthState.ProfileSetup;
        }

        return AuthState.Authenticated;
      }

      const currentStep = session?.data.conversationState?.currentStep;

      switch (currentStep) {
        case 'login_flow':
          return AuthState.LoginFlow;
        case 'register_flow':
          return AuthState.RegisterFlow;
        case 'verification_flow':
          return AuthState.VerificationFlow;
        case 'profile_setup':
          return AuthState.ProfileSetup;
        default:
          return AuthState.Unauthenticated;
      }
    } catch (err: unknown) {
      this.logger.error('Error getting auth state', {
        error: unknownToError(err),
        userId,
      });

      return AuthState.Unauthenticated;
    }
  }

  private async updateAuthState(userId: string, state: AuthState): Promise<void> {
    try {
      await this.sessionService.updateSession(userId, {
        conversationState: {
          currentStep: state,
          context: { authState: state, lastAuthUpdate: Date.now() },
          isActive: true,
        },
      });
    } catch (err: unknown) {
      this.logger.error('Error updating auth state', {
        error: unknownToError(err),
        userId,
        state,
      });
    }
  }

  private async composeAuthenticatedMenu(ctx: BotContext): Promise<MenuConfig> {
    // For authenticated users, redirect to main menu
    return await this.composePostAuthMenu(ctx, false);
  }

  private async composeWelcomeBackMenu(ctx: BotContext, user: UserEntity): Promise<MenuConfig> {
    const userName = user.firstName || ctx.from?.first_name || 'User';

    return {
      type: MenuType.Auth,
      title: `Welcome back, ${userName}! 👋`,
      description: 'You already have an account with us.',
      buttons: [
        [
          {
            text: '🏠 Go to Main Menu',
            callbackData: CallbackUtil.createMenuCallback('main'),
            metadata: { action: 'main_menu' },
          },
        ],
        [
          {
            text: '📊 View Dashboard',
            callbackData: CallbackUtil.createMenuCallback('statistics'),
            metadata: { action: 'dashboard' },
          },
          {
            text: '💰 Check Balance',
            callbackData: CallbackUtil.createMenuCallback('balance'),
            metadata: { action: 'balance' },
          },
        ],
        [
          {
            text: '👤 Profile Settings',
            callbackData: CallbackUtil.createMenuCallback('profile'),
            metadata: { action: 'profile' },
          },
        ],
      ],
      isInline: true,
      metadata: {
        flowType: 'welcome_back',
        userName,
        userId: user.id,
        timestamp: Date.now(),
      },
    };
  }

  private async composeAlreadyRegisteredMenu(ctx: BotContext, user: UserEntity): Promise<MenuConfig> {
    const userName = user.firstName || ctx.from?.first_name || 'User';

    return {
      type: MenuType.Auth,
      title: `Hi ${userName}! ✋`,
      description: 'You already have an account. Would you like to continue?',
      buttons: [
        [
          {
            text: '✅ Yes, Continue',
            callbackData: CallbackUtil.createMenuCallback('main'),
            metadata: { action: 'continue' },
          },
        ],
        [
          {
            text: "🔐 This isn't me",
            callbackData: CallbackUtil.createActionCallback('auth', 'logout'),
            metadata: { action: 'logout' },
          },
        ],
        [
          {
            text: '🆘 Contact Support',
            callbackData: CallbackUtil.createActionCallback('auth', 'contact_support'),
            metadata: { action: 'support' },
          },
        ],
      ],
      isInline: true,
      metadata: {
        flowType: 'already_registered',
        userName,
        userId: user.id,
        timestamp: Date.now(),
      },
    };
  }

  private getDefaultAuthMenu(_ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Auth,
      title: '🔐 Authentication',
      description: 'Please choose an option:',
      buttons: [
        [
          { text: '🔐 Login', callbackData: 'auth:login' },
          { text: '📝 Register', callbackData: 'auth:register' },
        ],
        [{ text: '❓ Help', callbackData: 'auth:help' }],
      ],
      isInline: true,
    };
  }

  private formatMenuText(menuConfig: MenuConfig): string {
    let text = `<b>${menuConfig.title}</b>`;

    if (menuConfig.description) {
      text += `\n\n${menuConfig.description}`;
    }

    return text;
  }
}
