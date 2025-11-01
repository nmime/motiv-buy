/* eslint-disable @typescript-eslint/require-await */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { MainMenuComposer } from '../main-menu.composer';
import { SessionService } from '../../service/session.service';
import { MenuService } from '../../service/menu.service';
import { AuthUserService } from '@app/feature-auth-shared';
import { BalanceService } from '@app/feature-balance-main';
import { BotContext, MenuConfig, MenuType } from '@app/feature-bot-shared';

// Mock Grammy components
jest.mock('grammy', () => ({
  Composer: jest.fn().mockImplementation(() => ({
    callbackQuery: jest.fn(),
  })),
  InlineKeyboard: jest.fn().mockImplementation(() => ({
    row: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    url: jest.fn().mockReturnThis(),
  })),
}));

describe('MainMenuComposer', () => {
  let composer: MainMenuComposer;
  let module: TestingModule;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockMenuService: jest.Mocked<MenuService>;
  let mockAuthUserService: jest.Mocked<AuthUserService>;
  let mockBalanceService: jest.Mocked<BalanceService>;

  const mockUserId = '123456789';
  const mockUserData = {
    id: mockUserId,
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
    isActive: true,
    isVerified: false,
    isAdmin: false,
    isPremium: false,
    createdAt: new Date('2023-01-01'),
  };

  const createMockBotContext = (overrides: Partial<BotContext> = {}): BotContext => ({
    from: {
      id: parseInt(mockUserId),
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
    },
    reply: jest.fn().mockResolvedValue({}),
    replyWithHTML: jest.fn().mockResolvedValue({}),
    editMessageText: jest.fn().mockResolvedValue({}),
    answerCallbackQuery: jest.fn().mockResolvedValue({}),
    callbackQuery: null,
    message: null,
    chat: null,
    session: {},
    state: {},
    ...overrides,
  });

  const createMockSession = () => ({
    userId: mockUserId,
    data: {
      preferences: {
        language: 'en',
        notifications: { enablePush: true, enableEmail: false, enableSms: false, categories: {} },
        display: { theme: 'auto', timezone: 'UTC', dateFormat: 'DD/MM/YYYY', numberFormat: 'en-US' },
        privacy: { shareAnalytics: true, shareUsageData: true, allowDataExport: true },
        hiddenFeatures: [],
      },
      navigationState: {
        currentLocation: MenuType.Main,
        history: [],
        breadcrumb: [],
        metadata: {},
      },
      cache: { recentActions: [] },
      formData: {},
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
    mockSessionService = {
      getOrCreateSession: jest.fn(),
      getSession: jest.fn(),
      updateSession: jest.fn(),
    } as any;

    mockMenuService = {
      navigateToMenu: jest.fn(),
    } as any;

    mockAuthUserService = {
      findByPlatformId: jest.fn(),
    } as any;

    mockBalanceService = {
      getUserBalance: jest.fn(),
    } as any;

    module = await Test.createTestingModule({
      providers: [
        MainMenuComposer,
        { provide: SessionService, useValue: mockSessionService },
        { provide: MenuService, useValue: mockMenuService },
        { provide: AuthUserService, useValue: mockAuthUserService },
        { provide: BalanceService, useValue: mockBalanceService },
      ],
    }).compile();

    composer = module.get<MainMenuComposer>(MainMenuComposer);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }

    jest.clearAllMocks();
  });

  describe('Composer Definition', () => {
    it('should be defined', () => {
      expect(composer).toBeDefined();
    });

    it('should return Grammy composer instance', () => {
      const grammyComposer = composer.getComposer();
      expect(grammyComposer).toBeDefined();
    });
  });

  describe('Main Menu Composition', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should compose main menu with user data', async () => {
      const session = createMockSession();
      const user = mockUserData;
      const balance = createMockBalance();

      mockSessionService.getOrCreateSession.mockResolvedValue(session);
      mockAuthUserService.findByPlatformId.mockResolvedValue(user);
      mockBalanceService.getUserBalance.mockResolvedValue(balance);

      const menuConfig = await composer.composeMainMenu(mockCtx);

      expect(menuConfig).toEqual(
        expect.objectContaining({
          type: MenuType.Main,
          title: 'Welcome back, Test! 🚀',
          description: 'Balance: $100.50 • Account not verified ⚠️',
          buttons: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({
                text: '💰 Balance ($100.50)',
                metadata: expect.objectContaining({ feature: 'balance', hasData: true }),
              }),
            ]),
          ]),
          isInline: true,
          metadata: expect.objectContaining({
            userId: mockUserId,
            hasBalance: true,
            isVerified: false,
          }),
        }),
      );
    });

    it('should compose default menu without user data', async () => {
      mockCtx.from = null;

      const menuConfig = await composer.composeMainMenu(mockCtx);

      expect(menuConfig).toEqual(
        expect.objectContaining({
          type: MenuType.Main,
          title: 'Welcome, User! 🚀',
          description: 'Choose an option from the menu below:',
          isInline: true,
        }),
      );
    });

    it('should handle composition errors gracefully', async () => {
      mockSessionService.getOrCreateSession.mockRejectedValue(new Error('Session error'));

      const menuConfig = await composer.composeMainMenu(mockCtx);

      expect(menuConfig).toEqual(
        expect.objectContaining({
          type: MenuType.Main,
          title: 'Welcome, Test! 🚀',
        }),
      );
    });

    it('should compose menu with verified user badge', async () => {
      const session = createMockSession();
      const user = { ...mockUserData, isVerified: true };
      const balance = createMockBalance();

      mockSessionService.getOrCreateSession.mockResolvedValue(session);
      mockAuthUserService.findByPlatformId.mockResolvedValue(user);
      mockBalanceService.getUserBalance.mockResolvedValue(balance);

      const menuConfig = await composer.composeMainMenu(mockCtx);

      expect(menuConfig.description).toContain('Account verified ✅');
      expect(menuConfig.buttons).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({
              text: '👤 Profile ✅',
              metadata: expect.objectContaining({ verified: true }),
            }),
          ]),
        ]),
      );
    });
  });

  describe('Quick Actions Menu', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should compose quick actions menu', async () => {
      const session = createMockSession();
      session.data.cache.recentActions = ['campaign', 'stats'];
      mockSessionService.getSession.mockResolvedValue(session);

      const menuConfig = await composer.composeQuickActionsMenu(mockCtx);

      expect(menuConfig).toEqual(
        expect.objectContaining({
          type: MenuType.Main,
          title: '⚡ Quick Actions',
          description: 'Frequently used actions for faster workflow',
          buttons: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({ text: '🚀 New Campaign' }),
              expect.objectContaining({ text: '📈 View Stats' }),
            ]),
            expect.arrayContaining([expect.objectContaining({ text: '📋 Recent Actions' })]),
          ]),
          metadata: expect.objectContaining({
            recentActionsCount: 2,
          }),
        }),
      );
    });

    it('should handle errors in quick actions composition', async () => {
      mockSessionService.getSession.mockRejectedValue(new Error('Session error'));

      const menuConfig = await composer.composeQuickActionsMenu(mockCtx);

      expect(menuConfig).toEqual(
        expect.objectContaining({
          title: '⚡ Quick Actions',
          buttons: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({ text: '📈 View Stats' }),
              expect.objectContaining({ text: '💰 Check Balance' }),
            ]),
          ]),
        }),
      );
    });
  });

  describe('Menu Customization', () => {
    let mockCtx: BotContext;
    let baseMenu: MenuConfig;

    beforeEach(() => {
      mockCtx = createMockBotContext();
      baseMenu = {
        type: MenuType.Main,
        title: 'Base Menu',
        buttons: [
          [
            { text: 'Button 1', callbackData: 'test:1' },
            { text: 'Button 2', callbackData: 'test:2' },
          ],
        ],
        isInline: true,
      };
    });

    it('should customize menu for premium user', async () => {
      const user = { ...mockUserData, isPremium: true };
      const session = createMockSession();

      const customizedMenu = await composer.customizeMenuForUser(baseMenu, mockCtx, user, session);

      expect(customizedMenu.buttons).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({
              text: '👑 Premium Analytics',
              metadata: expect.objectContaining({ feature: 'premium' }),
            }),
          ]),
        ]),
      );

      expect(customizedMenu.metadata?.customized).toBe(true);
    });

    it('should customize menu for admin user', async () => {
      const user = { ...mockUserData, isAdmin: true };
      const session = createMockSession();

      const customizedMenu = await composer.customizeMenuForUser(baseMenu, mockCtx, user, session);

      expect(customizedMenu.buttons).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({
              text: '🔧 Admin Panel',
              metadata: expect.objectContaining({ feature: 'admin', restricted: true }),
            }),
          ]),
        ]),
      );
    });

    it('should apply user preferences', async () => {
      const session = createMockSession();
      session.data.preferences.hiddenFeatures = ['balance'];

      const customizedMenu = await composer.customizeMenuForUser(baseMenu, mockCtx, mockUserData, session);

      expect(customizedMenu.metadata?.preferences).toEqual(session.data.preferences);
    });

    it('should apply A/B test variations', async () => {
      const session = createMockSession();
      mockCtx.from!.id = 25; // This should trigger A/B test variation

      baseMenu.buttons[0].push({ text: 'Statistics', callbackData: 'menu:statistics' });

      const customizedMenu = await composer.customizeMenuForUser(baseMenu, mockCtx, mockUserData, session);

      // Should change Statistics to Analytics for users with ID % 100 < 50
      expect(customizedMenu.buttons[0]).toEqual(
        expect.arrayContaining([expect.objectContaining({ text: '📊 Analytics' })]),
      );
    });

    it('should handle customization errors', async () => {
      const user = { ...mockUserData };
      const session = createMockSession();

      // Mock an error in role permissions
      jest.spyOn(composer as any, 'applyRolePermissions').mockRejectedValue(new Error('Permission error'));

      const customizedMenu = await composer.customizeMenuForUser(baseMenu, mockCtx, user, session);

      expect(customizedMenu).toEqual(baseMenu); // Should return original menu
    });
  });

  describe('Navigation Buttons', () => {
    let baseMenu: MenuConfig;

    beforeEach(() => {
      baseMenu = {
        type: MenuType.Main,
        title: 'Base Menu',
        buttons: [[{ text: 'Button 1', callbackData: 'test:1' }]],
        isInline: true,
      };
    });

    it('should add back and home navigation buttons', () => {
      const menuWithNav = composer.addNavigationButtons(baseMenu, {
        showBack: true,
        showHome: true,
      });

      expect(menuWithNav.buttons).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({
              text: '◀️ Back',
              metadata: expect.objectContaining({ action: 'navigation', type: 'back' }),
            }),
            expect.objectContaining({
              text: '🏠 Home',
              metadata: expect.objectContaining({ action: 'navigation', type: 'home' }),
            }),
          ]),
        ]),
      );
    });

    it('should add breadcrumb navigation button', () => {
      const menuWithNav = composer.addNavigationButtons(baseMenu, {
        showBreadcrumb: true,
      });

      expect(menuWithNav.buttons).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({
              text: '📍 Menu Path',
              metadata: expect.objectContaining({ action: 'navigation', type: 'breadcrumb' }),
            }),
          ]),
        ]),
      );
    });

    it('should use custom navigation callbacks', () => {
      const menuWithNav = composer.addNavigationButtons(baseMenu, {
        showBack: true,
        showHome: true,
        customBack: 'custom:back',
        customHome: 'custom:home',
      });

      expect(menuWithNav.buttons).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({
              text: '◀️ Back',
              callbackData: 'custom:back',
            }),
            expect.objectContaining({
              text: '🏠 Home',
              callbackData: 'custom:home',
            }),
          ]),
        ]),
      );
    });

    it('should not add navigation buttons when not requested', () => {
      const originalButtons = [...baseMenu.buttons];
      const menuWithNav = composer.addNavigationButtons(baseMenu, {});

      expect(menuWithNav.buttons).toEqual(originalButtons);
    });
  });

  describe('Inline Keyboard Creation', () => {
    it('should create inline keyboard from menu config', () => {
      const menuConfig: MenuConfig = {
        type: MenuType.Main,
        title: 'Test Menu',
        buttons: [
          [
            { text: 'Button 1', callbackData: 'action:1' },
            { text: 'Button 2', callbackData: 'action:2' },
          ],
          [{ text: 'URL Button', callbackData: 'url:test', url: 'https://example.com' }],
        ],
        isInline: true,
      };

      const keyboard = composer.createInlineKeyboard(menuConfig);

      expect(keyboard).toBeDefined();
      // Note: Grammy's InlineKeyboard is mocked, so we can't test the actual implementation
    });
  });

  describe('Performance Tests', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
      mockSessionService.getOrCreateSession.mockResolvedValue(createMockSession());
      mockAuthUserService.findByPlatformId.mockResolvedValue(mockUserData);
      mockBalanceService.getUserBalance.mockResolvedValue(createMockBalance());
    });

    it('should compose menu under performance threshold', async () => {
      const start = performance.now();
      await composer.composeMainMenu(mockCtx);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100); // Should compose under 100ms
    });

    it('should handle concurrent menu compositions', async () => {
      const promises = Array(5)
        .fill(null)
        .map(() => composer.composeMainMenu(mockCtx));

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.type).toBe(MenuType.Main);
      });
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory during composition lifecycle', async () => {
      const mockCtx = createMockBotContext();
      mockSessionService.getOrCreateSession.mockResolvedValue(createMockSession());
      mockAuthUserService.findByPlatformId.mockResolvedValue(mockUserData);
      mockBalanceService.getUserBalance.mockResolvedValue(createMockBalance());

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple composition operations
      for (let i = 0; i < 10; i++) {
        await composer.composeMainMenu(mockCtx);
        await composer.composeQuickActionsMenu(mockCtx);
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

  describe('Localization', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should generate localized greeting for different languages', async () => {
      const { getPersonalizedGreeting } = composer as any;

      expect(getPersonalizedGreeting.call(composer, 'Test', 'en')).toBe('Welcome back, Test! 🚀');
      expect(getPersonalizedGreeting.call(composer, 'Test', 'es')).toBe('¡Bienvenido de vuelta, Test! 🚀');
      expect(getPersonalizedGreeting.call(composer, 'Test', 'fr')).toBe('Bon retour, Test! 🚀');
      expect(getPersonalizedGreeting.call(composer, 'Test', 'de')).toBe('Willkommen zurück, Test! 🚀');
      expect(getPersonalizedGreeting.call(composer, 'Test', 'unknown')).toBe('Welcome back, Test! 🚀');
    });

    it('should generate appropriate menu description', () => {
      const { getMainMenuDescription } = composer as any;
      const balance = createMockBalance();

      // With verified user and balance
      const verifiedUser = { ...mockUserData, isVerified: true };
      expect(getMainMenuDescription.call(composer, verifiedUser, balance)).toBe(
        'Balance: $100.50 • Account verified ✅',
      );

      // With unverified user and balance
      expect(getMainMenuDescription.call(composer, mockUserData, balance)).toBe(
        'Balance: $100.50 • Account not verified ⚠️',
      );

      // Without user
      expect(getMainMenuDescription.call(composer)).toBe('Please register to access all features.');
    });
  });

  describe('Edge Cases', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should handle missing user context', async () => {
      mockCtx.from = null;

      const menuConfig = await composer.composeMainMenu(mockCtx);

      expect(menuConfig.title).toContain('User');
      expect(menuConfig.metadata?.userId).toBeUndefined();
    });

    it('should handle service failures gracefully', async () => {
      mockSessionService.getOrCreateSession.mockRejectedValue(new Error('Service error'));
      mockAuthUserService.findByPlatformId.mockRejectedValue(new Error('Auth error'));
      mockBalanceService.getUserBalance.mockRejectedValue(new Error('Balance error'));

      const menuConfig = await composer.composeMainMenu(mockCtx);

      expect(menuConfig).toBeDefined();
      expect(menuConfig.type).toBe(MenuType.Main);
    });

    it('should handle missing session data', async () => {
      mockSessionService.getOrCreateSession.mockResolvedValue(null);

      const menuConfig = await composer.composeMainMenu(mockCtx);

      expect(menuConfig).toBeDefined();
    });
  });
});
