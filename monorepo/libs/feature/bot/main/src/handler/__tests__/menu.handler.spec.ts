import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { MenuHandler } from '../menu.handler';
import { AuthUserService } from '@app/feature-auth-shared';
import { BalanceService } from '@app/feature-balance-main';
import { UserService } from '@app/feature-user-main';
import { StatisticService } from '@app/feature-statistic-main';
import { TrafficService } from '@app/feature-traffic-main';
import { SessionService } from '../../service/session.service';
import { MenuService } from '../../service/menu.service';
import { BotContext, MenuType, MenuConfig, MenuNavigation } from '@app/feature-bot-shared';

describe('MenuHandler', () => {
  let handler: MenuHandler;
  let module: TestingModule;
  let mockAuthUserService: jest.Mocked<AuthUserService>;
  let mockBalanceService: jest.Mocked<BalanceService>;
  let mockUserService: jest.Mocked<UserService>;
  let mockStatisticService: jest.Mocked<StatisticService>;
  let mockTrafficService: jest.Mocked<TrafficService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockMenuService: jest.Mocked<MenuService>;
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
    callbackQuery: null,
    session: {},
    state: {},
    ...overrides,
  });

  const createMockMenuConfig = (): MenuConfig => ({
    type: MenuType.Main,
    title: 'Test Menu',
    description: 'Test menu description',
    buttons: [
      [
        { text: 'Button 1', callbackData: 'test:button1' },
        { text: 'Button 2', callbackData: 'test:button2' },
      ],
    ],
    isInline: true,
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
        notifications: { enablePush: true, enableEmail: false, enableSms: false, categories: {} },
        display: { theme: 'auto', timezone: 'UTC', dateFormat: 'DD/MM/YYYY', numberFormat: 'en-US' },
        privacy: { shareAnalytics: true, shareUsageData: true, allowDataExport: true },
      },
      formData: {},
      cache: {},
      custom: {},
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    metadata: {},
  });

  const createMockBalance = () => ({
    availableAmount: 100.50,
    pendingAmount: 25.00,
    totalEarned: 500.00,
    lastTransactionAt: new Date('2023-06-01'),
  });

  beforeEach(async () => {
    mockAuthUserService = {
      findByPlatformId: jest.fn(),
    } as any;

    mockBalanceService = {
      getUserBalance: jest.fn(),
    } as any;

    mockUserService = {
      findById: jest.fn(),
    } as any;

    mockStatisticService = {} as any;

    mockTrafficService = {} as any;

    mockSessionService = {
      getSession: jest.fn(),
      updateSession: jest.fn(),
      getOrCreateSession: jest.fn(),
    } as any;

    mockMenuService = {
      generateMenu: jest.fn(),
      navigateToMenu: jest.fn(),
    } as any;

    module = await Test.createTestingModule({
      providers: [
        MenuHandler,
        { provide: AuthUserService, useValue: mockAuthUserService },
        { provide: BalanceService, useValue: mockBalanceService },
        { provide: UserService, useValue: mockUserService },
        { provide: StatisticService, useValue: mockStatisticService },
        { provide: TrafficService, useValue: mockTrafficService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: MenuService, useValue: mockMenuService },
      ],
    }).compile();

    handler = module.get<MenuHandler>(MenuHandler);
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

  describe('Menu Navigation', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
      mockSessionService.updateSession.mockResolvedValue({} as any);
      mockMenuService.generateMenu.mockReturnValue(createMockMenuConfig());
    });

    it('should navigate to menu successfully', async () => {
      await handler.navigateToMenu(mockCtx, MenuType.Profile);

      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          navigationState: expect.objectContaining({
            currentLocation: MenuType.Profile,
          }),
        })
      );
      expect(mockCtx.replyWithHTML).toHaveBeenCalled();
    });

    it('should edit message when callback query exists', async () => {
      mockCtx.callbackQuery = { id: 'test', data: 'test' } as any;

      await handler.navigateToMenu(mockCtx, MenuType.Profile);

      expect(mockCtx.editMessageText).toHaveBeenCalled();
      expect(mockCtx.replyWithHTML).not.toHaveBeenCalled();
    });

    it('should handle navigation without authentication', async () => {
      mockCtx.from = null;

      await handler.navigateToMenu(mockCtx, MenuType.Profile);

      expect(mockCtx.reply).toHaveBeenCalledWith('🔒 Authentication required to access menus.');
      expect(mockSessionService.updateSession).not.toHaveBeenCalled();
    });

    it('should handle navigation with custom options', async () => {
      const options = {
        updateHistory: false,
        clearBreadcrumb: true,
        customData: { test: true },
      };

      await handler.navigateToMenu(mockCtx, MenuType.Profile, options);

      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          navigationState: expect.objectContaining({
            metadata: expect.objectContaining({
              test: true,
              navigationType: 'direct',
            }),
          }),
        })
      );
    });

    it('should handle navigation state update errors', async () => {
      mockSessionService.updateSession.mockRejectedValue(new Error('Update failed'));

      await handler.navigateToMenu(mockCtx, MenuType.Profile);

      // Should still try to display menu despite navigation state error
      expect(mockCtx.replyWithHTML).toHaveBeenCalled();
    });

    it('should handle navigation errors gracefully', async () => {
      mockMenuService.generateMenu.mockImplementation(() => {
        throw new Error('Menu generation failed');
      });

      await handler.navigateToMenu(mockCtx, MenuType.Profile);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Sorry, there was a problem loading the menu'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '🏠 Main Menu' }),
                expect.objectContaining({ text: '🔄 Try Again' }),
              ]),
            ]),
          }),
        })
      );
    });
  });

  describe('Menu Action Handling', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
      mockSessionService.getSession.mockResolvedValue(createMockSession());
    });

    it('should handle menu navigation action', async () => {
      const navigateToMenuSpy = jest.spyOn(handler, 'navigateToMenu').mockResolvedValue();

      await handler.handleMenuAction(mockCtx, 'menu:profile');

      expect(navigateToMenuSpy).toHaveBeenCalledWith(mockCtx, 'profile');
    });

    it('should handle back navigation action', async () => {
      const goBackSpy = jest.spyOn(handler, 'goBack').mockResolvedValue();

      await handler.handleMenuAction(mockCtx, 'back');

      expect(goBackSpy).toHaveBeenCalledWith(mockCtx);
    });

    it('should handle refresh action', async () => {
      const getMenuNavigationSpy = jest.spyOn(handler, 'getMenuNavigation').mockResolvedValue({
        currentMenu: MenuType.Profile,
        history: [],
        maxHistoryLength: 5,
        canGoBack: false,
      });
      const navigateToMenuSpy = jest.spyOn(handler, 'navigateToMenu').mockResolvedValue();

      await handler.handleMenuAction(mockCtx, 'refresh');

      expect(getMenuNavigationSpy).toHaveBeenCalled();
      expect(navigateToMenuSpy).toHaveBeenCalledWith(mockCtx, MenuType.Profile);
    });

    it('should handle close menu action', async () => {
      await handler.handleMenuAction(mockCtx, 'close');

      expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledWith({
        inline_keyboard: [],
      });
    });

    it('should handle balance action', async () => {
      await handler.handleMenuAction(mockCtx, 'balance:current');

      expect(mockCtx.reply).toHaveBeenCalledWith('💰 Balance refreshed');
    });

    it('should handle unhandled actions', async () => {
      await handler.handleMenuAction(mockCtx, 'unknown:action');

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Action "unknown" is not implemented yet')
      );
    });

    it('should handle action processing errors', async () => {
      jest.spyOn(handler as any, 'processMenuAction').mockRejectedValue(new Error('Processing failed'));

      await handler.handleMenuAction(mockCtx, 'test:action');

      expect(mockCtx.reply).toHaveBeenCalledWith('Sorry, something went wrong. Please try again.');
    });

    it('should handle authentication required for actions', async () => {
      mockCtx.from = null;

      await handler.handleMenuAction(mockCtx, 'profile:edit');

      expect(mockCtx.reply).toHaveBeenCalledWith('🔒 Authentication required.');
    });

    it('should update session activity after action', async () => {
      await handler.handleMenuAction(mockCtx, 'test:action');

      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          conversationState: expect.objectContaining({
            currentStep: 'menu_action_test',
            context: expect.objectContaining({
              lastAction: 'test',
              lastActionParams: ['action'],
            }),
          }),
        })
      );
    });
  });

  describe('Menu Navigation State', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should get menu navigation successfully', async () => {
      const session = createMockSession();
      mockSessionService.getSession.mockResolvedValue(session);

      const navigation = await handler.getMenuNavigation(mockUserId);

      expect(navigation).toEqual({
        currentMenu: MenuType.Main,
        history: [MenuType.Profile],
        maxHistoryLength: 5,
        canGoBack: true,
      });
    });

    it('should return null when no session exists', async () => {
      mockSessionService.getSession.mockResolvedValue(null);

      const navigation = await handler.getMenuNavigation(mockUserId);

      expect(navigation).toBeNull();
    });

    it('should return null when no navigation state exists', async () => {
      const session = createMockSession();
      session.data.navigationState = undefined as any;
      mockSessionService.getSession.mockResolvedValue(session);

      const navigation = await handler.getMenuNavigation(mockUserId);

      expect(navigation).toBeNull();
    });

    it('should handle navigation errors gracefully', async () => {
      mockSessionService.getSession.mockRejectedValue(new Error('Session error'));

      const navigation = await handler.getMenuNavigation(mockUserId);

      expect(navigation).toBeNull();
    });

    it('should go back to previous menu', async () => {
      const session = createMockSession();
      session.data.navigationState.history = [MenuType.Settings, MenuType.Profile];
      mockSessionService.getSession.mockResolvedValue(session);
      const navigateToMenuSpy = jest.spyOn(handler, 'navigateToMenu').mockResolvedValue();

      await handler.goBack(mockCtx);

      expect(navigateToMenuSpy).toHaveBeenCalledWith(mockCtx, MenuType.Profile, { updateHistory: false });
      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          navigationState: expect.objectContaining({
            currentLocation: MenuType.Profile,
            history: [MenuType.Settings],
          }),
        })
      );
    });

    it('should go to main menu when no history exists', async () => {
      mockSessionService.getSession.mockResolvedValue(createMockSession());
      const getMenuNavigationSpy = jest.spyOn(handler, 'getMenuNavigation').mockResolvedValue({
        currentMenu: MenuType.Main,
        history: [],
        maxHistoryLength: 5,
        canGoBack: false,
      });
      const navigateToMenuSpy = jest.spyOn(handler, 'navigateToMenu').mockResolvedValue();

      await handler.goBack(mockCtx);

      expect(navigateToMenuSpy).toHaveBeenCalledWith(mockCtx, MenuType.Main);
    });

    it('should handle go back without authentication', async () => {
      mockCtx.from = null;

      await handler.goBack(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('🔒 Authentication required.');
    });

    it('should clear navigation history', async () => {
      await handler.clearNavigationHistory(mockUserId);

      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          navigationState: expect.objectContaining({
            currentLocation: MenuType.Main,
            history: [],
            breadcrumb: [],
            metadata: expect.objectContaining({
              clearedAt: expect.any(String),
            }),
          }),
        })
      );
    });
  });

  describe('Dynamic Menu Generation', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
      mockMenuService.generateMenu.mockReturnValue(createMockMenuConfig());
    });

    it('should enhance main menu with user data', async () => {
      const user = mockUserData;
      const balance = createMockBalance();
      mockAuthUserService.findByPlatformId.mockResolvedValue(user);
      mockBalanceService.getUserBalance.mockResolvedValue(balance);

      // Access private method for testing
      const generateDynamicMenu = (handler as any).generateDynamicMenu;
      const menuConfig = await generateDynamicMenu.call(handler, mockCtx, MenuType.Main);

      expect(menuConfig.title).toContain('$100.50');
      expect(menuConfig.metadata).toEqual(
        expect.objectContaining({
          userBalance: 100.50,
        })
      );
    });

    it('should enhance balance menu with transaction data', async () => {
      const user = mockUserData;
      const balance = createMockBalance();
      mockAuthUserService.findByPlatformId.mockResolvedValue(user);
      mockBalanceService.getUserBalance.mockResolvedValue(balance);

      const generateDynamicMenu = (handler as any).generateDynamicMenu;
      const menuConfig = await generateDynamicMenu.call(handler, mockCtx, MenuType.Balance);

      expect(menuConfig.description).toContain('$100.50');
      expect(menuConfig.description).toContain('$500.00');
      expect(menuConfig.description).toContain('$25.00');
    });

    it('should enhance profile menu with user information', async () => {
      const user = mockUserData;
      mockAuthUserService.findByPlatformId.mockResolvedValue(user);

      const generateDynamicMenu = (handler as any).generateDynamicMenu;
      const menuConfig = await generateDynamicMenu.call(handler, mockCtx, MenuType.Profile);

      expect(menuConfig.description).toContain('Test User');
      expect(menuConfig.description).toContain('testuser');
      expect(menuConfig.description).toContain('✅ Active');
      expect(menuConfig.description).toContain('❌ Unverified');
    });

    it('should enhance settings menu with preferences', async () => {
      const session = createMockSession();
      mockSessionService.getSession.mockResolvedValue(session);

      const generateDynamicMenu = (handler as any).generateDynamicMenu;
      const menuConfig = await generateDynamicMenu.call(handler, mockCtx, MenuType.Settings);

      expect(menuConfig.description).toContain('English');
      expect(menuConfig.description).toContain('Auto');
      expect(menuConfig.description).toContain('🔔 On');
      expect(menuConfig.description).toContain('UTC');
    });

    it('should return base menu on enhancement errors', async () => {
      mockAuthUserService.findByPlatformId.mockRejectedValue(new Error('User not found'));

      const generateDynamicMenu = (handler as any).generateDynamicMenu;
      const menuConfig = await generateDynamicMenu.call(handler, mockCtx, MenuType.Main);

      // Should return the base menu from menuService
      expect(mockMenuService.generateMenu).toHaveBeenCalledWith(MenuType.Main, mockCtx);
      expect(menuConfig).toEqual(createMockMenuConfig());
    });

    it('should handle menu generation errors', async () => {
      mockMenuService.generateMenu.mockImplementation(() => {
        throw new Error('Menu generation failed');
      });

      const generateDynamicMenu = (handler as any).generateDynamicMenu;
      const menuConfig = await generateDynamicMenu.call(handler, mockCtx, MenuType.Main);

      // Should return the fallback menu
      expect(menuConfig).toEqual(createMockMenuConfig());
    });
  });

  describe('Menu Action Processing', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
      mockSessionService.getSession.mockResolvedValue(createMockSession());
    });

    it('should process balance actions', async () => {
      const processMenuAction = (handler as any).processMenuAction;
      const result = await processMenuAction.call(handler, mockCtx, 'balance', ['current']);

      expect(result).toEqual({
        success: true,
        nextMenu: MenuType.Balance,
        message: '💰 Balance refreshed',
      });
    });

    it('should process profile actions', async () => {
      const processMenuAction = (handler as any).processMenuAction;
      const result = await processMenuAction.call(handler, mockCtx, 'profile', ['edit']);

      expect(result).toEqual({
        success: false,
        message: '📝 Profile editing coming soon!',
      });
    });

    it('should process settings actions', async () => {
      const processMenuAction = (handler as any).processMenuAction;
      const result = await processMenuAction.call(handler, mockCtx, 'settings', ['notifications']);

      expect(result).toEqual({
        success: false,
        message: '🔔 Notification settings coming soon!',
      });
    });

    it('should process stats actions', async () => {
      const processMenuAction = (handler as any).processMenuAction;
      const result = await processMenuAction.call(handler, mockCtx, 'stats', ['overview']);

      expect(result).toEqual({
        success: false,
        message: '📈 Statistics overview coming soon!',
      });
    });

    it('should process traffic actions', async () => {
      const processMenuAction = (handler as any).processMenuAction;
      const result = await processMenuAction.call(handler, mockCtx, 'traffic', ['live']);

      expect(result).toEqual({
        success: false,
        message: '📉 Live traffic stats coming soon!',
      });
    });

    it('should process help actions', async () => {
      const processMenuAction = (handler as any).processMenuAction;
      const result = await processMenuAction.call(handler, mockCtx, 'help', ['contact']);

      expect(result).toEqual({
        success: true,
        message: '📞 Contact support at @motivbuy_support or support@motivbuy.com',
      });
    });

    it('should handle unknown actions', async () => {
      const processMenuAction = (handler as any).processMenuAction;
      const result = await processMenuAction.call(handler, mockCtx, 'unknown', []);

      expect(result).toEqual({
        success: false,
        message: 'Action "unknown" is not implemented yet. Please try again or contact support.',
      });
    });
  });

  describe('Menu Text Formatting', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should format menu text with breadcrumbs', async () => {
      const getMenuNavigationSpy = jest.spyOn(handler, 'getMenuNavigation').mockResolvedValue({
        currentMenu: MenuType.Profile,
        history: [MenuType.Main, MenuType.Settings],
        maxHistoryLength: 5,
        canGoBack: true,
      });

      const menuConfig = createMockMenuConfig();
      const formatMenuText = (handler as any).formatMenuText;
      const result = await formatMenuText.call(handler, mockCtx, menuConfig);

      expect(result).toContain('<b>Test Menu</b>');
      expect(result).toContain('📍 Main › Settings › Profile');
      expect(result).toContain('Test menu description');
    });

    it('should format menu text without breadcrumbs', async () => {
      const getMenuNavigationSpy = jest.spyOn(handler, 'getMenuNavigation').mockResolvedValue({
        currentMenu: MenuType.Main,
        history: [],
        maxHistoryLength: 5,
        canGoBack: false,
      });

      const menuConfig = createMockMenuConfig();
      const formatMenuText = (handler as any).formatMenuText;
      const result = await formatMenuText.call(handler, mockCtx, menuConfig);

      expect(result).toContain('<b>Test Menu</b>');
      expect(result).not.toContain('📍');
      expect(result).toContain('Test menu description');
    });

    it('should handle menu display names correctly', async () => {
      const getMenuDisplayName = (handler as any).getMenuDisplayName;
      
      expect(getMenuDisplayName.call(handler, MenuType.Main)).toBe('Main');
      expect(getMenuDisplayName.call(handler, MenuType.Profile)).toBe('Profile');
      expect(getMenuDisplayName.call(handler, MenuType.Statistics)).toBe('Statistics');
      expect(getMenuDisplayName.call(handler, MenuType.Settings)).toBe('Settings');
    });
  });

  describe('Keyboard Creation', () => {
    it('should create inline keyboard from buttons', () => {
      const buttons = [
        [
          { text: 'Button 1', callbackData: 'action:1' },
          { text: 'Button 2', callbackData: 'action:2' },
        ],
        [
          { text: 'URL Button', callbackData: 'url:test', url: 'https://example.com' },
        ],
      ];

      const createInlineKeyboard = (handler as any).createInlineKeyboard;
      const keyboard = createInlineKeyboard.call(handler, buttons);

      expect(keyboard).toBeDefined();
      // Note: We can't easily test Grammy's InlineKeyboard implementation in unit tests
      // This would be better tested in integration tests
    });
  });

  describe('Error Handling', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should handle menu errors in development', async () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test menu error');

      const handleMenuError = (handler as any).handleMenuError;
      await handleMenuError.call(handler, mockCtx, error, MenuType.Profile);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        'Menu error: Test menu error',
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.any(Array),
          }),
        })
      );
    });

    it('should handle menu errors in production', async () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Test menu error');

      const handleMenuError = (handler as any).handleMenuError;
      await handleMenuError.call(handler, mockCtx, error, MenuType.Profile);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        'Sorry, there was a problem loading the menu. Please try again.',
        expect.any(Object)
      );
    });

    it('should handle action errors in development', async () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test action error');

      const handleActionError = (handler as any).handleActionError;
      await handleActionError.call(handler, mockCtx, error, 'test:action');

      expect(mockCtx.reply).toHaveBeenCalledWith(
        'Action error: Test action error',
        expect.any(Object)
      );
    });

    it('should handle action errors in production', async () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Test action error');

      const handleActionError = (handler as any).handleActionError;
      await handleActionError.call(handler, mockCtx, error, 'test:action');

      expect(mockCtx.reply).toHaveBeenCalledWith(
        'Sorry, that action failed. Please try again or return to the main menu.',
        expect.any(Object)
      );
    });

    it('should handle reply errors during error handling', async () => {
      const error = new Error('Test menu error');
      mockCtx.reply.mockRejectedValueOnce(new Error('Reply failed'));

      const handleMenuError = (handler as any).handleMenuError;
      await handleMenuError.call(handler, mockCtx, error, MenuType.Profile);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to send menu error message',
        expect.objectContaining({
          originalError: 'Test menu error',
          replyError: 'Reply failed',
        })
      );
    });
  });

  describe('Performance and Load Testing', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
      mockSessionService.updateSession.mockResolvedValue({} as any);
      mockMenuService.generateMenu.mockReturnValue(createMockMenuConfig());
    });

    it('should handle concurrent navigation requests', async () => {
      const promises = Array(5).fill(null).map(() => 
        handler.navigateToMenu(mockCtx, MenuType.Profile)
      );

      await Promise.all(promises);

      expect(mockSessionService.updateSession).toHaveBeenCalledTimes(5);
    });

    it('should process navigation under performance threshold', async () => {
      const start = performance.now();
      await handler.navigateToMenu(mockCtx, MenuType.Profile);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100); // Should process under 100ms
    });

    it('should handle multiple action processing', async () => {
      mockSessionService.getSession.mockResolvedValue(createMockSession());

      const actions = [
        'menu:profile',
        'menu:settings',
        'balance:current',
        'stats:overview',
        'help:contact',
      ];

      const promises = actions.map(action => 
        handler.handleMenuAction(mockCtx, action)
      );

      await Promise.all(promises);

      expect(mockCtx.reply || mockCtx.replyWithHTML).toHaveBeenCalledTimes(actions.length);
    });
  });

  describe('Memory Management', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
      mockSessionService.updateSession.mockResolvedValue({} as any);
      mockMenuService.generateMenu.mockReturnValue(createMockMenuConfig());
    });

    it('should not leak memory during navigation lifecycle', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple navigation operations
      for (let i = 0; i < 10; i++) {
        await handler.navigateToMenu(mockCtx, MenuType.Profile);
        await handler.handleMenuAction(mockCtx, 'menu:main');
        await handler.goBack(mockCtx);
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

  describe('Integration Tests', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
      mockSessionService.getSession.mockResolvedValue(createMockSession());
      mockSessionService.updateSession.mockResolvedValue({} as any);
      mockMenuService.generateMenu.mockReturnValue(createMockMenuConfig());
    });

    it('should complete full navigation flow', async () => {
      // Navigate to profile
      await handler.navigateToMenu(mockCtx, MenuType.Profile);
      expect(mockSessionService.updateSession).toHaveBeenCalled();

      // Handle menu action
      await handler.handleMenuAction(mockCtx, 'profile:edit');
      expect(mockCtx.reply).toHaveBeenCalled();

      // Go back
      await handler.goBack(mockCtx);
      expect(mockSessionService.updateSession).toHaveBeenCalledTimes(2);
    });

    it('should maintain navigation consistency', async () => {
      const session = createMockSession();
      session.data.navigationState.history = [MenuType.Main];
      mockSessionService.getSession.mockResolvedValue(session);

      // Navigate to settings
      await handler.navigateToMenu(mockCtx, MenuType.Settings);

      // Go back should return to main
      const navigateToMenuSpy = jest.spyOn(handler, 'navigateToMenu').mockResolvedValue();
      await handler.goBack(mockCtx);

      expect(navigateToMenuSpy).toHaveBeenCalledWith(mockCtx, MenuType.Main, { updateHistory: false });
    });
  });

  describe('Edge Cases', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should handle empty user ID', async () => {
      mockCtx.from = null;

      await handler.navigateToMenu(mockCtx, MenuType.Profile);

      expect(mockCtx.reply).toHaveBeenCalledWith('🔒 Authentication required to access menus.');
    });

    it('should handle session service failures gracefully', async () => {
      mockSessionService.updateSession.mockRejectedValue(new Error('Session error'));
      mockMenuService.generateMenu.mockReturnValue(createMockMenuConfig());

      await handler.navigateToMenu(mockCtx, MenuType.Profile);

      // Should still attempt to show menu
      expect(mockCtx.replyWithHTML).toHaveBeenCalled();
    });

    it('should handle malformed callback data', async () => {
      await handler.handleMenuAction(mockCtx, 'invalid-callback-data');

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Action "invalid-callback-data" is not implemented yet')
      );
    });

    it('should limit navigation history length', async () => {
      const session = createMockSession();
      // Create a long history
      session.data.navigationState.history = Array(10).fill(MenuType.Main);
      mockSessionService.getSession.mockResolvedValue(session);

      await handler.navigateToMenu(mockCtx, MenuType.Profile);

      const updateCall = mockSessionService.updateSession.mock.calls[0][1];
      expect(updateCall.navigationState.history.length).toBeLessThanOrEqual(5); // MAX_BREADCRUMB_LENGTH
    });
  });
});