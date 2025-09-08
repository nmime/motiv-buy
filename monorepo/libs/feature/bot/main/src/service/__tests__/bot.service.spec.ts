import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { BotService } from '../bot.service';
import { AuthService } from '@app/feature-auth-main';
import { AuthConfigService, AuthUserService } from '@app/feature-auth-shared';
import { SessionService } from '../session.service';
import { MenuService } from '../menu.service';
import { PlatformType } from '@app/database';
import { BotCommand } from '@app/feature-bot-shared';
import { Bot } from 'grammy';

// Mock Grammy Bot
jest.mock('grammy', () => ({
  Bot: jest.fn().mockImplementation(() => ({
    use: jest.fn(),
    catch: jest.fn(),
    command: jest.fn(),
    on: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  })),
  session: jest.fn(() => ({})),
}));

describe('BotService', () => {
  let service: BotService;
  let module: TestingModule;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockAuthConfigService: jest.Mocked<AuthConfigService>;
  let mockAuthUserService: jest.Mocked<AuthUserService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockMenuService: jest.Mocked<MenuService>;
  let mockBot: jest.Mocked<Bot>;
  let loggerSpy: jest.SpyInstance;

  const mockBotToken = 'mock-bot-token';
  const mockUserId = '123456789';
  const mockUserData = {
    id: mockUserId,
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
    languageCode: 'en',
  };

  beforeEach(async () => {
    // Mock dependencies
    mockAuthService = {
      auth: jest.fn(),
    } as any;

    mockAuthConfigService = {
      botToken: mockBotToken,
      isDev: true,
    } as any;

    mockAuthUserService = {
      findByPlatformId: jest.fn(),
    } as any;

    mockSessionService = {
      createSession: jest.fn(),
      getSession: jest.fn(),
      updateSession: jest.fn(),
    } as any;

    mockMenuService = {
      handleMenuAction: jest.fn(),
      navigateToMenu: jest.fn(),
    } as any;

    module = await Test.createTestingModule({
      providers: [
        BotService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuthConfigService, useValue: mockAuthConfigService },
        { provide: AuthUserService, useValue: mockAuthUserService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: MenuService, useValue: mockMenuService },
      ],
    }).compile();

    service = module.get<BotService>(BotService);
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    // Reset Bot mock
    mockBot = new Bot(mockBotToken) as jest.Mocked<Bot>;
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize bot service successfully', async () => {
      await service.initialize();

      expect(Bot).toHaveBeenCalledWith(mockBotToken);
      expect(loggerSpy).toHaveBeenCalledWith('Initializing Telegram bot service...');
      expect(loggerSpy).toHaveBeenCalledWith('Bot service initialized successfully');
    });

    it('should throw error when bot token is missing', async () => {
      mockAuthConfigService.botToken = '';

      await expect(service.initialize()).rejects.toThrow('Bot token is not configured');
    });

    it('should handle initialization errors', async () => {
      const mockError = new Error('Initialization failed');
      (Bot as jest.Mock).mockImplementationOnce(() => {
        throw mockError;
      });

      await expect(service.initialize()).rejects.toThrow('Initialization failed');
    });
  });

  describe('Bot Lifecycle', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should start bot successfully', async () => {
      await service.start();

      expect(mockBot.start).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith('Starting bot polling...');
      expect(loggerSpy).toHaveBeenCalledWith('Bot started successfully');
    });

    it('should handle start errors', async () => {
      const startError = new Error('Failed to start');
      mockBot.start.mockRejectedValueOnce(startError);

      await expect(service.start()).rejects.toThrow('Failed to start');
    });

    it('should not start bot if already running', async () => {
      await service.start();
      jest.clearAllMocks();

      await service.start();

      expect(mockBot.start).not.toHaveBeenCalled();
    });

    it('should stop bot successfully', async () => {
      await service.start();
      await service.stop();

      expect(mockBot.stop).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith('Stopping bot...');
      expect(loggerSpy).toHaveBeenCalledWith('Bot stopped successfully');
    });

    it('should handle stop errors gracefully', async () => {
      await service.start();
      const stopError = new Error('Failed to stop');
      mockBot.stop.mockRejectedValueOnce(stopError);

      await service.stop(); // Should not throw

      expect(mockBot.stop).toHaveBeenCalled();
    });

    it('should not stop bot if not running', async () => {
      await service.stop();

      expect(mockBot.stop).not.toHaveBeenCalled();
    });
  });

  describe('Command Processing', () => {
    let mockCtx: any;

    beforeEach(async () => {
      await service.initialize();
      
      mockCtx = {
        from: {
          id: parseInt(mockUserId),
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser',
          language_code: 'en',
        },
        reply: jest.fn().mockResolvedValue({}),
        replyWithMarkdown: jest.fn().mockResolvedValue({}),
        replyWithHTML: jest.fn().mockResolvedValue({}),
      };
    });

    it('should process start command successfully', async () => {
      mockAuthService.auth.mockResolvedValueOnce({ success: true });

      await service.processCommand(mockCtx, BotCommand.Start);

      expect(mockAuthService.auth).toHaveBeenCalledWith({
        userData: expect.objectContaining({
          id: mockUserId,
          firstName: 'Test',
        }),
        platformType: PlatformType.TelegramBot,
        ip: '0.0.0.0',
      });
      expect(mockSessionService.createSession).toHaveBeenCalled();
    });

    it('should process help command successfully', async () => {
      await service.processCommand(mockCtx, BotCommand.Help);

      expect(mockCtx.replyWithMarkdown).toHaveBeenCalled();
    });

    it('should process profile command successfully', async () => {
      await service.processCommand(mockCtx, BotCommand.Profile);

      expect(mockMenuService.navigateToMenu).toHaveBeenCalledWith(mockCtx, 'profile');
    });

    it('should handle authentication required for protected commands', async () => {
      mockCtx.from = null;

      await service.processCommand(mockCtx, BotCommand.Profile);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        'Please authenticate first by using the /start command.'
      );
    });

    it('should handle unknown commands', async () => {
      await service.processCommand(mockCtx, 'unknown_command' as BotCommand);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('I don\'t understand that command')
      );
    });

    it('should handle command processing errors', async () => {
      mockAuthService.auth.mockRejectedValueOnce(new Error('Auth failed'));

      await service.processCommand(mockCtx, BotCommand.Start);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Error: Auth failed')
      );
    });
  });

  describe('Authentication Middleware', () => {
    let mockGrammyCtx: any;

    beforeEach(async () => {
      await service.initialize();
      
      mockGrammyCtx = {
        from: {
          id: parseInt(mockUserId),
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser',
          language_code: 'en',
          is_bot: false,
        },
        session: {},
      };
    });

    it('should authenticate user successfully', async () => {
      mockAuthService.auth.mockResolvedValueOnce({ success: true });

      // Get the middleware function that was registered
      const middlewareCall = mockBot.use.mock.calls.find(call => 
        call[0].toString().includes('authenticateUser')
      );
      expect(middlewareCall).toBeDefined();

      const middleware = middlewareCall[0];
      const next = jest.fn();

      await middleware(mockGrammyCtx, next);

      expect(mockGrammyCtx.isAuthenticated).toBe(true);
      expect(mockGrammyCtx.userId).toBe(mockUserId);
      expect(mockGrammyCtx.userData).toEqual(expect.objectContaining({
        id: mockUserId,
        firstName: 'Test',
      }));
      expect(next).toHaveBeenCalled();
    });

    it('should handle authentication failure', async () => {
      mockAuthService.auth.mockResolvedValueOnce({ 
        success: false, 
        error: new Error('Auth failed') 
      });

      const middlewareCall = mockBot.use.mock.calls.find(call => 
        call[0].toString().includes('authenticateUser')
      );
      const middleware = middlewareCall[0];
      const next = jest.fn();

      await middleware(mockGrammyCtx, next);

      expect(mockGrammyCtx.isAuthenticated).toBe(false);
      expect(next).toHaveBeenCalled();
    });

    it('should handle missing user data', async () => {
      mockGrammyCtx.from = null;

      const middlewareCall = mockBot.use.mock.calls.find(call => 
        call[0].toString().includes('authenticateUser')
      );
      const middleware = middlewareCall[0];
      const next = jest.fn();

      await middleware(mockGrammyCtx, next);

      expect(mockGrammyCtx.isAuthenticated).toBe(false);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    let mockCtx: any;

    beforeEach(() => {
      mockCtx = {
        from: { id: parseInt(mockUserId) },
        reply: jest.fn().mockResolvedValue({}),
      };
    });

    it('should handle errors with development details', async () => {
      const testError = new Error('Test error message');
      mockAuthConfigService.isDev = true;

      await service.handleError(testError, mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('Error: Test error message');
    });

    it('should handle errors with production message', async () => {
      const testError = new Error('Test error message');
      mockAuthConfigService.isDev = false;

      await service.handleError(testError, mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        'Sorry, something went wrong. Please try again later.'
      );
    });

    it('should handle errors without context', async () => {
      const testError = new Error('Test error message');

      await service.handleError(testError);

      // Should not throw and should log error
      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('should handle reply errors gracefully', async () => {
      const testError = new Error('Test error message');
      const replyError = new Error('Reply failed');
      mockCtx.reply.mockRejectedValueOnce(replyError);

      await service.handleError(testError, mockCtx);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to send error message',
        expect.objectContaining({
          originalError: 'Test error message',
          replyError: 'Reply failed',
        })
      );
    });
  });

  describe('Module Lifecycle', () => {
    it('should handle module initialization', async () => {
      const initializeSpy = jest.spyOn(service, 'initialize');

      await service.onModuleInit();

      expect(initializeSpy).toHaveBeenCalled();
    });

    it('should handle module destruction', async () => {
      const shutdownSpy = jest.spyOn(service, 'shutdown');

      await service.onModuleDestroy();

      expect(shutdownSpy).toHaveBeenCalled();
    });

    it('should shutdown gracefully', async () => {
      await service.initialize();
      await service.start();

      await service.shutdown();

      expect(loggerSpy).toHaveBeenCalledWith('Shutting down bot service...');
      expect(loggerSpy).toHaveBeenCalledWith('Bot service shutdown completed');
    });
  });

  describe('Command Registration', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should register all command handlers', () => {
      const expectedCommands = ['start', 'help', 'profile', 'settings', 'balance', 'menu'];
      
      expectedCommands.forEach(command => {
        expect(mockBot.command).toHaveBeenCalledWith(command, expect.any(Function));
      });
    });

    it('should register callback query handler', () => {
      expect(mockBot.on).toHaveBeenCalledWith('callback_query:data', expect.any(Function));
    });

    it('should register error handler', () => {
      expect(mockBot.catch).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Context Mapping', () => {
    let grammyCtx: any;

    beforeEach(() => {
      grammyCtx = {
        message: {
          message_id: 123,
          text: 'test message',
          from: {
            id: parseInt(mockUserId),
            is_bot: false,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser',
            language_code: 'en',
          },
          chat: {
            id: parseInt(mockUserId),
            type: 'private',
            first_name: 'Test',
            last_name: 'User',
          },
          date: 1234567890,
        },
        from: {
          id: parseInt(mockUserId),
          is_bot: false,
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser',
          language_code: 'en',
        },
        reply: jest.fn(),
        editMessageText: jest.fn(),
        answerCallbackQuery: jest.fn(),
        session: { test: 'data' },
        userData: mockUserData,
      };
    });

    it('should map Grammy context to BotContext correctly', () => {
      // Access private method for testing
      const mapContext = (service as any).mapContextToBotContext;
      const botContext = mapContext.call(service, grammyCtx);

      expect(botContext).toEqual(expect.objectContaining({
        message: expect.objectContaining({
          message_id: 123,
          text: 'test message',
        }),
        from: expect.objectContaining({
          id: parseInt(mockUserId),
          first_name: 'Test',
        }),
        session: { test: 'data' },
        state: mockUserData,
      }));
    });

    it('should handle context with callback query', () => {
      grammyCtx.callbackQuery = {
        id: 'callback123',
        from: grammyCtx.from,
        data: 'test:callback',
      };

      const mapContext = (service as any).mapContextToBotContext;
      const botContext = mapContext.call(service, grammyCtx);

      expect(botContext.callbackQuery).toEqual(expect.objectContaining({
        id: 'callback123',
        data: 'test:callback',
      }));
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent command processing', async () => {
      await service.initialize();
      
      const mockCtx = {
        from: { id: parseInt(mockUserId), first_name: 'Test' },
        reply: jest.fn().mockResolvedValue({}),
      };

      const promises = Array(10).fill(null).map(() => 
        service.processCommand(mockCtx, BotCommand.Help)
      );

      await Promise.all(promises);

      expect(mockCtx.reply).toHaveBeenCalledTimes(10);
    });

    it('should process commands under performance threshold', async () => {
      await service.initialize();
      
      const mockCtx = {
        from: { id: parseInt(mockUserId), first_name: 'Test' },
        reply: jest.fn().mockResolvedValue({}),
      };

      const start = performance.now();
      await service.processCommand(mockCtx, BotCommand.Help);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100); // Should process under 100ms
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory during bot lifecycle', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Initialize and shutdown multiple times
      for (let i = 0; i < 5; i++) {
        await service.initialize();
        await service.shutdown();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Integration with Dependencies', () => {
    it('should integrate correctly with AuthService', async () => {
      await service.initialize();
      
      mockAuthService.auth.mockResolvedValueOnce({ success: true });
      
      const mockCtx = {
        from: { id: parseInt(mockUserId), first_name: 'Test' },
        reply: jest.fn(),
      };

      await service.processCommand(mockCtx, BotCommand.Start);

      expect(mockAuthService.auth).toHaveBeenCalledWith(
        expect.objectContaining({
          platformType: PlatformType.TelegramBot,
        })
      );
    });

    it('should integrate correctly with SessionService', async () => {
      await service.initialize();
      
      const mockCtx = {
        from: { id: parseInt(mockUserId), first_name: 'Test' },
        reply: jest.fn(),
      };

      await service.processCommand(mockCtx, BotCommand.Start);

      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        mockUserId,
        expect.any(Object)
      );
    });

    it('should integrate correctly with MenuService', async () => {
      await service.initialize();
      
      const mockCtx = {
        from: { id: parseInt(mockUserId), first_name: 'Test' },
        callbackQuery: { data: 'menu:main' },
        answerCallbackQuery: jest.fn(),
      };

      // Simulate callback query handling
      const callbackHandler = mockBot.on.mock.calls
        .find(call => call[0] === 'callback_query:data')[1];
      
      await callbackHandler(mockCtx);

      expect(mockMenuService.handleMenuAction).toHaveBeenCalledWith(
        expect.any(Object),
        'menu:main'
      );
    });
  });
});