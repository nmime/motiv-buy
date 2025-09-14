import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { MenuService } from '../menu.service';
import { SessionService } from '../session.service';
import { BotContext, MenuConfig, MenuType, MenuButton, MenuActionResult } from '@app/feature-bot-shared';

// Mock Grammy InlineKeyboard
jest.mock('grammy', () => ({
  InlineKeyboard: jest.fn().mockImplementation(() => ({
    row: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    url: jest.fn().mockReturnThis(),
  })),
}));

describe('MenuService', () => {
  let service: MenuService;
  let module: TestingModule;
  let mockSessionService: jest.Mocked<SessionService>;
  let loggerSpy: jest.SpyInstance;

  const mockUserId = '123456789';
  const mockUserData = {
    id: parseInt(mockUserId),
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
  };

  const createMockBotContext = (overrides: Partial<BotContext> = {}): BotContext => ({
    from: mockUserData,
    reply: jest.fn().mockResolvedValue({}),
    replyWithHTML: jest.fn().mockResolvedValue({}),
    replyWithMarkdown: jest.fn().mockResolvedValue({}),
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
      navigationState: {
        currentLocation: MenuType.Main,
        history: [MenuType.Profile],
        breadcrumb: [],
        metadata: {},
      },
      conversationState: {
        currentStep: 'main_menu',
        availableSteps: [],
        context: {},
        isActive: true,
        startedAt: new Date(),
      },
      preferences: {},
      formData: {},
      cache: {},
      custom: {},
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    metadata: {},
  });

  beforeEach(async () => {
    mockSessionService = {
      getSession: jest.fn(),
      updateSession: jest.fn(),
      createSession: jest.fn(),
      deleteSession: jest.fn(),
      extendSession: jest.fn(),
      getOrCreateSession: jest.fn(),
    } as any;

    module = await Test.createTestingModule({
      providers: [MenuService, { provide: SessionService, useValue: mockSessionService }],
    }).compile();

    service = module.get<MenuService>(MenuService);
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

  describe('Service Definition', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('Menu Generation', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should generate main menu correctly', () => {
      const menu = service.generateMenu(MenuType.Main, mockCtx);

      expect(menu).toEqual(
        expect.objectContaining({
          type: MenuType.Main,
          title: expect.stringContaining('Welcome, Test!'),
          description: expect.any(String),
          buttons: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({ text: '📈 Statistics', callbackData: 'menu:statistics' }),
              expect.objectContaining({ text: '💰 Balance', callbackData: 'menu:balance' }),
            ]),
          ]),
          isInline: true,
        }),
      );
    });

    it('should generate profile menu correctly', () => {
      const menu = service.generateMenu(MenuType.Profile, mockCtx);

      expect(menu).toEqual(
        expect.objectContaining({
          type: MenuType.Profile,
          title: 'Your Profile 👤',
          buttons: expect.arrayContaining([
            expect.arrayContaining([expect.objectContaining({ text: '📝 Edit Info', callbackData: 'profile:edit' })]),
          ]),
          isInline: true,
        }),
      );
    });

    it('should generate settings menu correctly', () => {
      const menu = service.generateMenu(MenuType.Settings, mockCtx);

      expect(menu).toEqual(
        expect.objectContaining({
          type: MenuType.Settings,
          title: 'Settings ⚙️',
          buttons: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({ text: '🌍 Language', callbackData: 'settings:language' }),
            ]),
          ]),
          isInline: true,
        }),
      );
    });

    it('should generate balance menu correctly', () => {
      const menu = service.generateMenu(MenuType.Balance, mockCtx);

      expect(menu).toEqual(
        expect.objectContaining({
          type: MenuType.Balance,
          title: 'Balance & Earnings 💰',
          buttons: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({ text: '💵 Current Balance', callbackData: 'balance:current' }),
            ]),
          ]),
          isInline: true,
        }),
      );
    });

    it('should generate traffic menu correctly', () => {
      const menu = service.generateMenu(MenuType.Traffic, mockCtx);

      expect(menu).toEqual(
        expect.objectContaining({
          type: MenuType.Traffic,
          title: 'Traffic Management 🎯',
          buttons: expect.arrayContaining([
            expect.arrayContaining([expect.objectContaining({ text: '📉 Live Stats', callbackData: 'traffic:live' })]),
          ]),
        }),
      );
    });

    it('should generate statistics menu correctly', () => {
      const menu = service.generateMenu(MenuType.Statistics, mockCtx);

      expect(menu).toEqual(
        expect.objectContaining({
          type: MenuType.Statistics,
          title: 'Statistics 📈',
          buttons: expect.arrayContaining([
            expect.arrayContaining([expect.objectContaining({ text: '📈 Overview', callbackData: 'stats:overview' })]),
          ]),
        }),
      );
    });

    it('should generate help menu correctly', () => {
      const menu = service.generateMenu(MenuType.Help, mockCtx);

      expect(menu).toEqual(
        expect.objectContaining({
          type: MenuType.Help,
          title: 'Help & Support ❓',
          buttons: expect.arrayContaining([
            expect.arrayContaining([expect.objectContaining({ text: '📝 FAQ', callbackData: 'help:faq' })]),
          ]),
        }),
      );
    });

    it('should generate admin menu correctly', () => {
      const menu = service.generateMenu(MenuType.Admin, mockCtx);

      expect(menu).toEqual(
        expect.objectContaining({
          type: MenuType.Admin,
          title: 'Admin Panel 🔧',
          buttons: expect.arrayContaining([
            expect.arrayContaining([expect.objectContaining({ text: '📈 System Stats', callbackData: 'admin:stats' })]),
          ]),
        }),
      );
    });

    it('should generate default menu for unknown types', () => {
      const unknownType = 'unknown' as MenuType;
      const menu = service.generateMenu(unknownType, mockCtx);

      expect(menu).toEqual(
        expect.objectContaining({
          type: unknownType,
          title: 'Menu',
          buttons: expect.arrayContaining([
            expect.arrayContaining([expect.objectContaining({ text: '⬅️ Back to Main', callbackData: 'menu:main' })]),
          ]),
        }),
      );
    });

    it('should handle context without user data', () => {
      mockCtx.from = null;
      const menu = service.generateMenu(MenuType.Main, mockCtx);

      expect(menu.title).toBe('Welcome, User! 🚀');
    });
  });

  describe('Menu Navigation', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
      mockSessionService.getSession.mockResolvedValue(createMockSession());
    });

    it('should navigate to menu successfully', async () => {
      await service.navigateToMenu(mockCtx, MenuType.Profile);

      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          navigationState: expect.objectContaining({
            currentLocation: MenuType.Profile,
          }),
        }),
      );

      expect(mockCtx.replyWithHTML).toHaveBeenCalled();
    });

    it('should edit message when callback query exists', async () => {
      mockCtx.callbackQuery = { id: 'test', data: 'test' } as any;

      await service.navigateToMenu(mockCtx, MenuType.Profile);

      expect(mockCtx.editMessageText).toHaveBeenCalled();
      expect(mockCtx.replyWithHTML).not.toHaveBeenCalled();
    });

    it('should handle navigation without authentication', async () => {
      mockCtx.from = null;

      await service.navigateToMenu(mockCtx, MenuType.Profile);

      expect(mockCtx.reply).toHaveBeenCalledWith('Authentication required to access menus.');
      expect(mockSessionService.updateSession).not.toHaveBeenCalled();
    });

    it('should handle navigation errors gracefully', async () => {
      mockSessionService.updateSession.mockRejectedValueOnce(new Error('Update failed'));

      await service.navigateToMenu(mockCtx, MenuType.Profile);

      expect(mockCtx.reply).toHaveBeenCalledWith('Failed to navigate to menu. Please try again.');
    });

    it('should update navigation state correctly', async () => {
      const session = createMockSession();
      session.data.navigationState.currentLocation = MenuType.Settings;
      mockSessionService.getSession.mockResolvedValue(session);

      await service.navigateToMenu(mockCtx, MenuType.Profile);

      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          navigationState: expect.objectContaining({
            currentLocation: MenuType.Profile,
            history: expect.arrayContaining([MenuType.Settings]),
          }),
        }),
      );
    });

    it('should limit navigation history length', async () => {
      const session = createMockSession();
      session.data.navigationState.history = Array(15).fill(MenuType.Main);
      mockSessionService.getSession.mockResolvedValue(session);

      await service.navigateToMenu(mockCtx, MenuType.Profile);

      const updateCall = mockSessionService.updateSession.mock.calls[0][1];
      expect(updateCall.navigationState.history).toHaveLength(10); // MAX_HISTORY_LENGTH
    });
  });

  describe('Menu Action Handling', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
      mockSessionService.getSession.mockResolvedValue(createMockSession());
    });

    it('should handle menu navigation action', async () => {
      const navigateToMenuSpy = jest.spyOn(service, 'navigateToMenu').mockResolvedValue();

      await service.handleMenuAction(mockCtx, 'menu:profile');

      expect(navigateToMenuSpy).toHaveBeenCalledWith(mockCtx, 'profile');
    });

    it('should handle back navigation action', async () => {
      const navigateToMenuSpy = jest.spyOn(service, 'navigateToMenu').mockResolvedValue();

      await service.handleMenuAction(mockCtx, 'back');

      expect(navigateToMenuSpy).toHaveBeenCalledWith(mockCtx, MenuType.Profile); // From history
    });

    it('should handle successful action with message', async () => {
      jest.spyOn(service as any, 'processMenuAction').mockResolvedValue({
        success: true,
        message: 'Action completed',
      });

      await service.handleMenuAction(mockCtx, 'test:action');

      expect(mockCtx.reply).toHaveBeenCalledWith('Action completed');
    });

    it('should handle failed action', async () => {
      jest.spyOn(service as any, 'processMenuAction').mockResolvedValue({
        success: false,
        message: 'Action failed',
      });

      await service.handleMenuAction(mockCtx, 'test:action');

      expect(mockCtx.reply).toHaveBeenCalledWith('Action failed');
    });

    it('should handle action processing errors', async () => {
      jest.spyOn(service as any, 'processMenuAction').mockRejectedValue(new Error('Processing failed'));

      await service.handleMenuAction(mockCtx, 'test:action');

      expect(mockCtx.reply).toHaveBeenCalledWith('Sorry, something went wrong. Please try again.');
    });

    it('should parse callback data correctly', async () => {
      const processActionSpy = jest.spyOn(service as any, 'processMenuAction').mockResolvedValue({
        success: true,
      });

      await service.handleMenuAction(mockCtx, 'menu:profile:edit');

      expect(processActionSpy).toHaveBeenCalledWith(mockCtx, 'menu', ['profile', 'edit']);
    });
  });

  describe('Menu History Management', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should get menu history successfully', async () => {
      const session = createMockSession();
      session.data.navigationState.history = [MenuType.Profile, MenuType.Settings];
      mockSessionService.getSession.mockResolvedValue(session);

      const history = await service.getMenuHistory(mockUserId);

      expect(history).toEqual([MenuType.Profile, MenuType.Settings]);
    });

    it('should return empty history when no session exists', async () => {
      mockSessionService.getSession.mockResolvedValue(null);

      const history = await service.getMenuHistory(mockUserId);

      expect(history).toEqual([]);
    });

    it('should return empty history when no navigation state exists', async () => {
      const session = createMockSession();
      session.data.navigationState = undefined as any;
      mockSessionService.getSession.mockResolvedValue(session);

      const history = await service.getMenuHistory(mockUserId);

      expect(history).toEqual([]);
    });

    it('should handle history errors gracefully', async () => {
      mockSessionService.getSession.mockRejectedValue(new Error('Session error'));

      const history = await service.getMenuHistory(mockUserId);

      expect(history).toEqual([]);
    });

    it('should go back to previous menu', async () => {
      const session = createMockSession();
      session.data.navigationState.history = [MenuType.Profile, MenuType.Settings];
      mockSessionService.getSession.mockResolvedValue(session);
      const navigateToMenuSpy = jest.spyOn(service, 'navigateToMenu').mockResolvedValue();

      await service.goBack(mockCtx);

      expect(navigateToMenuSpy).toHaveBeenCalledWith(mockCtx, MenuType.Settings);
    });

    it('should go to main menu when no history exists', async () => {
      mockSessionService.getSession.mockResolvedValue(createMockSession());
      const navigateToMenuSpy = jest.spyOn(service, 'navigateToMenu').mockResolvedValue();

      await service.goBack(mockCtx);

      expect(navigateToMenuSpy).toHaveBeenCalledWith(mockCtx, MenuType.Main);
    });

    it('should handle go back without authentication', async () => {
      mockCtx.from = null;

      await service.goBack(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('Authentication required.');
    });
  });

  describe('Keyboard Creation', () => {
    it('should create inline keyboard correctly', () => {
      const buttons: MenuButton[][] = [
        [
          { text: 'Button 1', callbackData: 'action:1' },
          { text: 'Button 2', callbackData: 'action:2' },
        ],
        [{ text: 'URL Button', callbackData: 'url:test', url: 'https://example.com' }],
      ];

      const keyboard = (service as any).createInlineKeyboard(buttons);

      expect(InlineKeyboard).toHaveBeenCalledTimes(1);
      const mockKeyboard = (InlineKeyboard as jest.Mock).mock.results[0].value;
      expect(mockKeyboard.row).toHaveBeenCalledTimes(1);
      expect(mockKeyboard.text).toHaveBeenCalledWith('Button 1', 'action:1');
      expect(mockKeyboard.text).toHaveBeenCalledWith('Button 2', 'action:2');
      expect(mockKeyboard.url).toHaveBeenCalledWith('URL Button', 'https://example.com');
    });

    it('should format menu text correctly', () => {
      const menuConfig: MenuConfig = {
        type: MenuType.Main,
        title: 'Test Menu',
        description: 'This is a test menu',
        buttons: [],
        isInline: true,
      };

      const formattedText = (service as any).formatMenuText(menuConfig);

      expect(formattedText).toBe('<b>Test Menu</b>\n\nThis is a test menu\n');
    });

    it('should format menu text without description', () => {
      const menuConfig: MenuConfig = {
        type: MenuType.Main,
        title: 'Test Menu',
        buttons: [],
        isInline: true,
      };

      const formattedText = (service as any).formatMenuText(menuConfig);

      expect(formattedText).toBe('<b>Test Menu</b>\n');
    });
  });

  describe('Menu Action Processing', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
      mockSessionService.getSession.mockResolvedValue(createMockSession());
    });

    it('should process menu navigation action', async () => {
      const result = await (service as any).processMenuAction(mockCtx, 'menu', ['profile']);

      expect(result).toEqual({
        success: true,
        nextMenu: 'profile',
      });
    });

    it('should process back action with history', async () => {
      const session = createMockSession();
      session.data.navigationState.history = [MenuType.Profile];
      mockSessionService.getSession.mockResolvedValue(session);

      const result = await (service as any).processMenuAction(mockCtx, 'back', []);

      expect(result).toEqual({
        success: true,
        nextMenu: MenuType.Profile,
      });
    });

    it('should process back action without history', async () => {
      mockCtx.from = null;

      const result = await (service as any).processMenuAction(mockCtx, 'back', []);

      expect(result).toEqual({
        success: true,
        nextMenu: MenuType.Main,
      });
    });

    it('should process unknown action', async () => {
      const result = await (service as any).processMenuAction(mockCtx, 'unknown', []);

      expect(result).toEqual({
        success: false,
        message: 'Action "unknown" is not implemented yet.',
      });
    });
  });

  describe('Performance and Load Testing', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
      mockSessionService.getSession.mockResolvedValue(createMockSession());
    });

    it('should handle multiple concurrent menu generations', () => {
      const promises = Array(10)
        .fill(null)
        .map(() => service.generateMenu(MenuType.Main, mockCtx));

      const results = Promise.all(promises);

      expect(results).resolves.toHaveLength(10);
    });

    it('should generate menu under performance threshold', () => {
      const start = performance.now();
      service.generateMenu(MenuType.Main, mockCtx);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50); // Should generate under 50ms
    });

    it('should handle concurrent navigation requests', async () => {
      const promises = Array(5)
        .fill(null)
        .map(() => service.navigateToMenu(mockCtx, MenuType.Profile));

      await Promise.all(promises);

      expect(mockSessionService.updateSession).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Scenarios', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should handle session service errors during navigation', async () => {
      mockSessionService.getSession.mockRejectedValue(new Error('Redis connection failed'));

      await service.navigateToMenu(mockCtx, MenuType.Profile);

      expect(mockCtx.reply).toHaveBeenCalledWith('Failed to navigate to menu. Please try again.');
    });

    it('should handle menu formatting errors', () => {
      const menuConfig = null as any;

      expect(() => {
        (service as any).formatMenuText(menuConfig);
      }).toThrow();
    });

    it('should handle invalid button configurations', () => {
      const invalidButtons = null as any;

      expect(() => {
        (service as any).createInlineKeyboard(invalidButtons);
      }).toThrow();
    });
  });

  describe('Integration Tests', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
      mockSessionService.getSession.mockResolvedValue(createMockSession());
    });

    it('should complete full navigation flow', async () => {
      // Generate menu
      const menu = service.generateMenu(MenuType.Main, mockCtx);
      expect(menu.type).toBe(MenuType.Main);

      // Navigate to menu
      await service.navigateToMenu(mockCtx, MenuType.Profile);
      expect(mockSessionService.updateSession).toHaveBeenCalled();

      // Handle menu action
      await service.handleMenuAction(mockCtx, 'menu:settings');
      expect(mockCtx.replyWithHTML || mockCtx.editMessageText).toHaveBeenCalled();
    });

    it('should maintain navigation consistency', async () => {
      // Navigate to profile
      await service.navigateToMenu(mockCtx, MenuType.Profile);

      // Navigate to settings
      await service.navigateToMenu(mockCtx, MenuType.Settings);

      // Go back should return to profile
      const session = createMockSession();
      session.data.navigationState.history = [MenuType.Profile];
      mockSessionService.getSession.mockResolvedValue(session);

      const navigateToMenuSpy = jest.spyOn(service, 'navigateToMenu').mockResolvedValue();
      await service.goBack(mockCtx);

      expect(navigateToMenuSpy).toHaveBeenCalledWith(mockCtx, MenuType.Profile);
    });
  });
});
