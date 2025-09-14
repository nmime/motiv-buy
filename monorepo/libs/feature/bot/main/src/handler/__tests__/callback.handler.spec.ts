import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CallbackHandler } from '../callback.handler';
import { AuthService } from '@app/feature-auth-main';
import { AuthUserService } from '@app/feature-auth-shared';
import { BalanceService } from '@app/feature-balance-main';
import { UserService } from '@app/feature-user-main';
import { SessionService } from '../../service/session.service';
import { MenuService } from '../../service/menu.service';
import { MenuHandler } from '../menu.handler';
import { BotContext, MenuType } from '@app/feature-bot-shared';
import { PlatformType } from '@app/database';

describe('CallbackHandler', () => {
  let handler: CallbackHandler;
  let module: TestingModule;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockAuthUserService: jest.Mocked<AuthUserService>;
  let mockBalanceService: jest.Mocked<BalanceService>;
  let mockUserService: jest.Mocked<UserService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockMenuService: jest.Mocked<MenuService>;
  let mockMenuHandler: jest.Mocked<MenuHandler>;
  let loggerSpy: jest.SpyInstance;

  const mockUserId = '123456789';
  const mockUserData = {
    id: mockUserId,
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
    isActive: true,
    isVerified: false,
    isAdmin: false,
    createdAt: new Date('2023-01-01'),
  };

  const createMockBotContext = (overrides: Partial<BotContext> = {}): BotContext => ({
    from: {
      id: parseInt(mockUserId),
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      language_code: 'en',
    },
    chat: {
      id: parseInt(mockUserId),
      type: 'private',
    } as any,
    reply: jest.fn().mockResolvedValue({}),
    replyWithHTML: jest.fn().mockResolvedValue({}),
    replyWithMarkdown: jest.fn().mockResolvedValue({}),
    editMessageText: jest.fn().mockResolvedValue({}),
    editMessageReplyMarkup: jest.fn().mockResolvedValue({}),
    answerCallbackQuery: jest.fn().mockResolvedValue({}),
    message: null,
    callbackQuery: {
      id: 'callback123',
      data: 'test:callback',
    } as any,
    session: {},
    state: {},
    ...overrides,
  });

  const createMockSession = () => ({
    userId: mockUserId,
    data: {
      navigationState: {
        currentLocation: MenuType.Main,
        history: [MenuType.Profile],
        breadcrumb: [MenuType.Main],
        metadata: {},
      },
      conversationState: {
        currentStep: 'main_menu',
        availableSteps: [],
        context: {},
        isActive: true,
        startedAt: new Date(),
      },
      preferences: {
        language: 'en',
        notifications: {
          enablePush: true,
          enableEmail: false,
          enableSms: false,
          categories: { balance: true, campaigns: false },
        },
        display: { theme: 'auto', timezone: 'UTC', dateFormat: 'DD/MM/YYYY', numberFormat: 'en-US' },
        privacy: { shareAnalytics: true, shareUsageData: true, allowDataExport: true },
      },
      formData: {},
      cache: { recentActions: [] },
      custom: {},
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    metadata: {},
  });

  const createMockBalance = () => ({
    availableAmount: 100.5,
    pendingAmount: 25.0,
    totalEarned: 500.0,
    lastTransactionAt: new Date('2023-06-01'),
  });

  beforeEach(async () => {
    mockAuthService = {
      auth: jest.fn(),
    } as any;

    mockAuthUserService = {
      findByPlatformId: jest.fn(),
    } as any;

    mockBalanceService = {
      getUserBalance: jest.fn(),
    } as any;

    mockUserService = {
      findById: jest.fn(),
    } as any;

    mockSessionService = {
      getSession: jest.fn(),
      updateSession: jest.fn(),
      createSession: jest.fn(),
      deleteSession: jest.fn(),
    } as any;

    mockMenuService = {
      navigateToMenu: jest.fn(),
    } as any;

    mockMenuHandler = {
      navigateToMenu: jest.fn(),
      getMenuNavigation: jest.fn(),
    } as any;

    module = await Test.createTestingModule({
      providers: [
        CallbackHandler,
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuthUserService, useValue: mockAuthUserService },
        { provide: BalanceService, useValue: mockBalanceService },
        { provide: UserService, useValue: mockUserService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: MenuService, useValue: mockMenuService },
        { provide: MenuHandler, useValue: mockMenuHandler },
      ],
    }).compile();

    handler = module.get<CallbackHandler>(CallbackHandler);
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }

    jest.clearAllMocks();
  });

  describe('Handler Definition', () => {
    it('should be defined', () => {
      expect(handler).toBeDefined();
    });
  });

  describe('Callback Query Processing', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should process callback query successfully', async () => {
      await handler.processCallbackQuery(mockCtx);

      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          conversationState: expect.objectContaining({
            currentStep: 'callback_test',
            context: expect.objectContaining({
              lastCallback: 'test:callback',
            }),
          }),
        }),
      );

      expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
    });

    it('should handle missing callback data', async () => {
      mockCtx.callbackQuery!.data = undefined;

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith('Invalid callback data');
    });

    it('should handle callback query without data', async () => {
      mockCtx.callbackQuery = null;

      await handler.processCallbackQuery(mockCtx);

      expect(Logger.prototype.warn).toHaveBeenCalledWith('Callback query received without data', expect.any(Object));
    });

    it('should handle callback processing errors', async () => {
      const routeCallbackSpy = jest
        .spyOn(handler as any, 'routeCallback')
        .mockRejectedValue(new Error('Processing failed'));

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith('Something went wrong. Please try again.');
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Callback error: Processing failed'),
        expect.any(Object),
      );
    });

    it('should handle answer callback query errors', async () => {
      mockCtx.answerCallbackQuery.mockRejectedValue(new Error('Answer failed'));
      const routeCallbackSpy = jest
        .spyOn(handler as any, 'routeCallback')
        .mockRejectedValue(new Error('Processing failed'));

      await handler.processCallbackQuery(mockCtx);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to answer callback query',
        expect.objectContaining({
          answerError: 'Answer failed',
        }),
      );
    });

    it('should always answer callback query on success', async () => {
      mockCtx.callbackQuery!.data = 'menu:main';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.answerCallbackQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('Callback Routing', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should route menu callbacks', async () => {
      mockCtx.callbackQuery!.data = 'menu:profile';

      await handler.processCallbackQuery(mockCtx);

      expect(mockMenuHandler.navigateToMenu).toHaveBeenCalledWith(mockCtx, 'profile');
    });

    it('should route auth callbacks', async () => {
      mockCtx.callbackQuery!.data = 'auth:register';

      await handler.processCallbackQuery(mockCtx);

      // Should trigger user registration
      expect(mockAuthService.auth).toHaveBeenCalled();
    });

    it('should route profile callbacks', async () => {
      mockCtx.callbackQuery!.data = 'profile:edit';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Profile editing is coming soon'),
        expect.any(Object),
      );
    });

    it('should route settings callbacks', async () => {
      mockCtx.callbackQuery!.data = 'settings:notifications';

      await handler.processCallbackQuery(mockCtx);

      expect(mockSessionService.getSession).toHaveBeenCalled();
    });

    it('should route balance callbacks', async () => {
      mockCtx.callbackQuery!.data = 'balance:current';

      await handler.processCallbackQuery(mockCtx);

      expect(mockMenuHandler.navigateToMenu).toHaveBeenCalledWith(mockCtx, MenuType.Balance);
    });

    it('should route help callbacks', async () => {
      mockCtx.callbackQuery!.data = 'help:contact';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Contact Support'), expect.any(Object));
    });

    it('should route back callbacks', async () => {
      mockCtx.callbackQuery!.data = 'back';

      await handler.processCallbackQuery(mockCtx);

      expect(mockMenuHandler.goBack).toHaveBeenCalledWith(mockCtx);
    });

    it('should route close callbacks', async () => {
      mockCtx.callbackQuery!.data = 'close';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledWith({
        inline_keyboard: [],
      });
    });

    it('should route refresh callbacks', async () => {
      const session = createMockSession();
      mockSessionService.getSession.mockResolvedValue(session);
      mockMenuHandler.getMenuNavigation.mockResolvedValue({
        currentMenu: MenuType.Profile,
        history: [],
        maxHistoryLength: 5,
        canGoBack: false,
      });

      mockCtx.callbackQuery!.data = 'refresh';

      await handler.processCallbackQuery(mockCtx);

      expect(mockMenuHandler.navigateToMenu).toHaveBeenCalledWith(mockCtx, MenuType.Profile);
      expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith('🔄 Menu refreshed');
    });

    it('should handle unknown callbacks', async () => {
      mockCtx.callbackQuery!.data = 'unknown:action';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Unknown action: "unknown"'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '📋 Main Menu' }),
                expect.objectContaining({ text: '🆘 Support' }),
              ]),
            ]),
          }),
        }),
      );
    });
  });

  describe('Authentication Callbacks', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should handle user registration for new user', async () => {
      mockCtx.callbackQuery!.data = 'auth:register';
      mockAuthUserService.findByPlatformId.mockResolvedValue(null);
      mockAuthService.auth.mockResolvedValue({ success: true });

      await handler.processCallbackQuery(mockCtx);

      expect(mockAuthService.auth).toHaveBeenCalledWith({
        userData: {
          id: mockUserId,
          firstName: 'Test',
          lastName: 'User',
          username: 'testuser',
          languageCode: 'en',
        },
        platformType: PlatformType.TelegramBot,
        ip: '0.0.0.0',
      });

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('✅ Registration completed successfully'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '📋 Main Menu' }),
                expect.objectContaining({ text: '👤 Profile' }),
              ]),
            ]),
          }),
        }),
      );

      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          conversationState: expect.objectContaining({
            currentStep: 'registered',
            context: { justRegistered: true },
          }),
        }),
      );
    });

    it('should handle registration for existing user', async () => {
      mockCtx.callbackQuery!.data = 'auth:register';
      mockAuthUserService.findByPlatformId.mockResolvedValue(mockUserData);

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('✅ You are already registered! Welcome back.');
      expect(mockMenuHandler.navigateToMenu).toHaveBeenCalledWith(mockCtx, MenuType.Main);
      expect(mockAuthService.auth).not.toHaveBeenCalled();
    });

    it('should handle registration failure', async () => {
      mockCtx.callbackQuery!.data = 'auth:register';
      mockAuthUserService.findByPlatformId.mockResolvedValue(null);
      mockAuthService.auth.mockResolvedValue({ success: false });

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('❌ Registration failed'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '🔄 Try Again' }),
                expect.objectContaining({ text: '🆘 Support' }),
              ]),
            ]),
          }),
        }),
      );
    });

    it('should handle registration errors', async () => {
      mockCtx.callbackQuery!.data = 'auth:register';
      mockAuthUserService.findByPlatformId.mockRejectedValue(new Error('Database error'));

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('❌ Registration failed due to a technical error'),
        expect.any(Object),
      );
    });

    it('should handle user logout', async () => {
      mockCtx.callbackQuery!.data = 'auth:logout';

      await handler.processCallbackQuery(mockCtx);

      expect(mockSessionService.deleteSession).toHaveBeenCalledWith(mockUserId);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('👋 You have been logged out successfully'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([expect.objectContaining({ text: '🚀 Start Over' })]),
            ]),
          }),
        }),
      );
    });

    it('should handle auth start callback', async () => {
      mockCtx.callbackQuery!.data = 'auth:start';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        'Welcome to MotivBuy! Please use /start to begin.',
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([expect.objectContaining({ text: '🚀 Start' })]),
            ]),
          }),
        }),
      );
    });

    it('should handle registration without user data', async () => {
      mockCtx.from = null;
      mockCtx.callbackQuery!.data = 'auth:register';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('❌ Registration failed - user information not available.');
    });
  });

  describe('Profile Callbacks', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should display profile stats', async () => {
      mockCtx.callbackQuery!.data = 'profile:stats';
      const user = mockUserData;
      const balance = createMockBalance();
      mockAuthUserService.findByPlatformId.mockResolvedValue(user);
      mockBalanceService.getUserBalance.mockResolvedValue(balance);

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('📊 Profile Statistics'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '🔄 Refresh' }),
                expect.objectContaining({ text: '📈 Detailed Stats' }),
              ]),
            ]),
          }),
        }),
      );

      const statsCall = mockCtx.replyWithHTML.mock.calls[0];
      const statsText = statsCall[0];

      expect(statsText).toContain('Test User');
      expect(statsText).toContain('testuser');
      expect(statsText).toContain('$100.50');
      expect(statsText).toContain('$500.00');
      expect(statsText).toContain('✅ Active');
      expect(statsText).toContain('❌ No');
    });

    it('should handle profile stats for user not found', async () => {
      mockCtx.callbackQuery!.data = 'profile:stats';
      mockAuthUserService.findByPlatformId.mockResolvedValue(null);

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('❌ User profile not found.');
    });

    it('should handle profile security settings', async () => {
      mockCtx.callbackQuery!.data = 'profile:security';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🔒 Security Settings'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '🔑 Change Password' }),
                expect.objectContaining({ text: '📧 Email Security' }),
              ]),
            ]),
          }),
        }),
      );
    });

    it('should require authentication for profile actions', async () => {
      mockCtx.from = null;
      mockCtx.callbackQuery!.data = 'profile:edit';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('🔒 Authentication required for profile actions.');
    });
  });

  describe('Settings Callbacks', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should display notification settings', async () => {
      const session = createMockSession();
      mockSessionService.getSession.mockResolvedValue(session);
      mockCtx.callbackQuery!.data = 'settings:notifications';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('🔔 Notification Settings'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([expect.objectContaining({ text: '🔕 Disable Push' })]),
            ]),
          }),
        }),
      );

      const settingsCall = mockCtx.replyWithHTML.mock.calls[0];
      const settingsText = settingsCall[0];

      expect(settingsText).toContain('✅ Enabled');
      expect(settingsText).toContain('❌ Disabled');
      expect(settingsText).toContain('✅'); // Balance notifications enabled
    });

    it('should display language settings', async () => {
      const session = createMockSession();
      mockSessionService.getSession.mockResolvedValue(session);
      mockCtx.callbackQuery!.data = 'settings:language';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('🌍 Language Settings'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '✅ English' }),
                expect.objectContaining({ text: '🇪🇸 Español' }),
              ]),
            ]),
          }),
        }),
      );
    });

    it('should display theme settings', async () => {
      mockCtx.callbackQuery!.data = 'settings:theme';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🎨 Theme Settings'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([expect.objectContaining({ text: '⬅️ Back' })]),
            ]),
          }),
        }),
      );
    });

    it('should display privacy settings', async () => {
      const session = createMockSession();
      mockSessionService.getSession.mockResolvedValue(session);
      mockCtx.callbackQuery!.data = 'settings:privacy';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('🔒 Privacy Settings'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([expect.objectContaining({ text: '📊❌ Disable Analytics' })]),
            ]),
          }),
        }),
      );
    });

    it('should require authentication for settings', async () => {
      mockCtx.from = null;
      mockCtx.callbackQuery!.data = 'settings:notifications';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('🔒 Authentication required for settings.');
    });
  });

  describe('Language Callbacks', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should update user language', async () => {
      mockCtx.callbackQuery!.data = 'language:es';

      await handler.processCallbackQuery(mockCtx);

      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          preferences: {
            language: 'es',
          },
        }),
      );

      expect(mockCtx.reply).toHaveBeenCalledWith('🌍 Language changed to Español');
    });

    it('should handle invalid language selection', async () => {
      mockCtx.callbackQuery!.data = 'language:';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('❌ Invalid language selection.');
    });

    it('should handle language change without authentication', async () => {
      mockCtx.from = null;
      mockCtx.callbackQuery!.data = 'language:es';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('❌ Invalid language selection.');
    });
  });

  describe('Reset Callbacks', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should reset user session', async () => {
      mockCtx.callbackQuery!.data = 'reset:session';

      await handler.processCallbackQuery(mockCtx);

      expect(mockSessionService.deleteSession).toHaveBeenCalledWith(mockUserId);
      expect(mockSessionService.createSession).toHaveBeenCalledWith(mockUserId);
      expect(mockCtx.reply).toHaveBeenCalledWith('🗂️ Session data has been reset successfully.');
    });

    it('should reset notification settings', async () => {
      mockCtx.callbackQuery!.data = 'reset:notifications';

      await handler.processCallbackQuery(mockCtx);

      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          preferences: {
            notifications: {
              enablePush: true,
              enableEmail: false,
              enableSms: false,
              categories: {},
            },
          },
        }),
      );

      expect(mockCtx.reply).toHaveBeenCalledWith('🔔 Notification settings have been reset to defaults.');
    });

    it('should reset user preferences', async () => {
      mockCtx.callbackQuery!.data = 'reset:preferences';

      await handler.processCallbackQuery(mockCtx);

      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          preferences: expect.objectContaining({
            language: 'en',
            display: expect.objectContaining({
              theme: 'auto',
            }),
            privacy: expect.objectContaining({
              shareAnalytics: true,
            }),
          }),
        }),
      );

      expect(mockCtx.reply).toHaveBeenCalledWith('⚙️ All preferences have been reset to defaults.');
    });

    it('should clear user cache', async () => {
      mockCtx.callbackQuery!.data = 'reset:cache';

      await handler.processCallbackQuery(mockCtx);

      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          cache: {},
          formData: {},
        }),
      );

      expect(mockCtx.reply).toHaveBeenCalledWith('🧹 Cache has been cleared successfully.');
    });

    it('should require authentication for reset operations', async () => {
      mockCtx.from = null;
      mockCtx.callbackQuery!.data = 'reset:session';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('🔒 Authentication required.');
    });
  });

  describe('Help Callbacks', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should display FAQ', async () => {
      mockCtx.callbackQuery!.data = 'help:faq';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('📚 Frequently Asked Questions'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '💬 Contact Support' }),
                expect.objectContaining({ text: '📖 More Help' }),
              ]),
            ]),
          }),
        }),
      );

      const faqCall = mockCtx.replyWithHTML.mock.calls[0];
      const faqText = faqCall[0];

      expect(faqText).toContain('How do I track my campaigns?');
      expect(faqText).toContain('When can I withdraw my earnings?');
      expect(faqText).toContain('Is my data secure?');
    });

    it('should display contact information', async () => {
      mockCtx.callbackQuery!.data = 'help:contact';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('📞 Contact Support'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '💬 Telegram Support',
                  url: 'https://t.me/motivbuy_support',
                }),
              ]),
            ]),
          }),
        }),
      );
    });

    it('should display tutorials menu', async () => {
      mockCtx.callbackQuery!.data = 'help:tutorials';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('📚 Tutorials & Guides'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([expect.objectContaining({ text: '🚀 Getting Started' })]),
            ]),
          }),
        }),
      );
    });

    it('should display recent updates', async () => {
      mockCtx.callbackQuery!.data = 'help:updates';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('📢 Recent Updates'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '📝 Full Changelog' }),
                expect.objectContaining({ text: '🔔 Subscribe to Updates' }),
              ]),
            ]),
          }),
        }),
      );

      const updatesCall = mockCtx.reply.mock.calls[0];
      const updatesText = updatesCall[0];

      expect(updatesText).toContain('Enhanced menu navigation');
      expect(updatesText).toContain('Version 1.0.0');
    });
  });

  describe('Balance Callbacks', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should refresh balance display', async () => {
      mockCtx.callbackQuery!.data = 'balance:current';

      await handler.processCallbackQuery(mockCtx);

      expect(mockMenuHandler.navigateToMenu).toHaveBeenCalledWith(mockCtx, MenuType.Balance);
    });

    it('should display transaction history placeholder', async () => {
      mockCtx.callbackQuery!.data = 'balance:history';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('📈 Transaction History'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([expect.objectContaining({ text: '⬅️ Back to Balance' })]),
            ]),
          }),
        }),
      );
    });

    it('should require authentication for balance actions', async () => {
      mockCtx.from = null;
      mockCtx.callbackQuery!.data = 'balance:current';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('🔒 Authentication required for balance information.');
    });
  });

  describe('Other Feature Callbacks', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should handle stats callbacks', async () => {
      mockCtx.callbackQuery!.data = 'stats:overview';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('📊 Statistics feature coming soon!');
    });

    it('should handle traffic callbacks', async () => {
      mockCtx.callbackQuery!.data = 'traffic:sources';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('🎯 Traffic management coming soon!');
    });

    it('should handle campaign callbacks', async () => {
      mockCtx.callbackQuery!.data = 'campaign:new';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('📋 Campaign management coming soon!');
    });

    it('should handle withdrawal callbacks', async () => {
      mockCtx.callbackQuery!.data = 'withdrawal:request';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('💸 Withdrawal system coming soon!');
    });

    it('should handle referral callbacks', async () => {
      mockCtx.callbackQuery!.data = 'referral:invite';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('🤝 Referral program coming soon!');
    });

    it('should handle admin callbacks', async () => {
      mockCtx.callbackQuery!.data = 'admin:panel';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('🔧 Admin panel access restricted.');
    });

    it('should handle verify callbacks', async () => {
      mockCtx.callbackQuery!.data = 'verify:email';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('✅ Verification system coming soon!');
    });

    it('should handle export callbacks', async () => {
      mockCtx.callbackQuery!.data = 'export:data';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('📥 Data export coming soon!');
    });

    it('should handle notifications callbacks', async () => {
      mockCtx.callbackQuery!.data = 'notifications:toggle';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('🔔 Notification settings coming soon!');
    });

    it('should handle command callbacks', async () => {
      mockCtx.callbackQuery!.data = 'command:help';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        'Executing command: /help\n\nPlease use the actual /help command instead.',
      );
    });
  });

  describe('Error Handling', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should handle callback errors in development', async () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test callback error');
      jest.spyOn(handler as any, 'routeCallback').mockRejectedValue(error);

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        'Callback error: Test callback error',
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '📋 Main Menu' }),
                expect.objectContaining({ text: '🆘 Support' }),
              ]),
            ]),
          }),
        }),
      );
    });

    it('should handle callback errors in production', async () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Test callback error');
      jest.spyOn(handler as any, 'routeCallback').mockRejectedValue(error);

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        'Sorry, something went wrong. Please try again or return to the main menu.',
        expect.any(Object),
      );
    });

    it('should handle reply errors during error handling', async () => {
      const error = new Error('Test callback error');
      mockCtx.reply.mockRejectedValueOnce(new Error('Reply failed'));
      jest.spyOn(handler as any, 'routeCallback').mockRejectedValue(error);

      await handler.processCallbackQuery(mockCtx);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to send callback error message',
        expect.objectContaining({
          originalError: 'Test callback error',
          replyError: 'Reply failed',
        }),
      );
    });
  });

  describe('Activity Tracking', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should update callback activity', async () => {
      await handler.processCallbackQuery(mockCtx);

      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          conversationState: expect.objectContaining({
            currentStep: 'callback_test',
            context: expect.objectContaining({
              lastCallback: 'test:callback',
              lastCallbackAt: expect.any(String),
            }),
            isActive: true,
          }),
        }),
      );
    });

    it('should handle activity update errors gracefully', async () => {
      mockSessionService.updateSession.mockRejectedValue(new Error('Update failed'));

      await handler.processCallbackQuery(mockCtx);

      // Should not fail callback processing
      expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
    });

    it('should not update activity without user context', async () => {
      mockCtx.from = null;

      await handler.processCallbackQuery(mockCtx);

      expect(mockSessionService.updateSession).not.toHaveBeenCalled();
    });
  });

  describe('Performance and Load Testing', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should handle concurrent callback processing', async () => {
      const callbacks = ['menu:profile', 'settings:language', 'help:contact', 'balance:current', 'stats:overview'];

      const promises = callbacks.map((callbackData) => {
        const ctx = createMockBotContext();
        ctx.callbackQuery!.data = callbackData;

        return handler.processCallbackQuery(ctx);
      });

      await Promise.all(promises);

      expect(mockSessionService.updateSession).toHaveBeenCalledTimes(callbacks.length);
    });

    it('should process callbacks under performance threshold', async () => {
      const start = performance.now();
      await handler.processCallbackQuery(mockCtx);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100); // Should process under 100ms
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory during callback lifecycle', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process multiple callbacks
      for (let i = 0; i < 10; i++) {
        const ctx = createMockBotContext();
        ctx.callbackQuery!.data = `menu:profile${i}`;
        await handler.processCallbackQuery(ctx);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 5MB)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('Edge Cases', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should handle empty callback data', async () => {
      mockCtx.callbackQuery!.data = '';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Unknown action: ""'), expect.any(Object));
    });

    it('should handle malformed callback data', async () => {
      mockCtx.callbackQuery!.data = 'invalid::callback::data';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Unknown action: "invalid"'),
        expect.any(Object),
      );
    });

    it('should handle missing user ID for authenticated callbacks', async () => {
      mockCtx.from!.id = undefined as any;
      mockCtx.callbackQuery!.data = 'profile:edit';

      await handler.processCallbackQuery(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('🔒 Authentication required for profile actions.');
    });
  });
});
