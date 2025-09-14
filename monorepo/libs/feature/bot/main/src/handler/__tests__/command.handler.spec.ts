import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CommandHandler } from '../command.handler';
import { AuthService } from '@app/feature-auth-main';
import { AuthUserService } from '@app/feature-auth-shared';
import { BalanceService } from '@app/feature-balance-main';
import { UserService } from '@app/feature-user-main';
import { SessionService } from '../../service/session.service';
import { MenuService } from '../../service/menu.service';
import { BotContext, BotCommand, MenuType } from '@app/feature-bot-shared';

describe('CommandHandler', () => {
  let handler: CommandHandler;
  let module: TestingModule;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockAuthUserService: jest.Mocked<AuthUserService>;
  let mockBalanceService: jest.Mocked<BalanceService>;
  let mockUserService: jest.Mocked<UserService>;
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
    answerCallbackQuery: jest.fn().mockResolvedValue({}),
    message: null,
    callbackQuery: null,
    session: {},
    state: {},
    ...overrides,
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
      createSession: jest.fn(),
      updateSession: jest.fn(),
      getSession: jest.fn(),
    } as any;

    mockMenuService = {
      navigateToMenu: jest.fn(),
    } as any;

    module = await Test.createTestingModule({
      providers: [
        CommandHandler,
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuthUserService, useValue: mockAuthUserService },
        { provide: BalanceService, useValue: mockBalanceService },
        { provide: UserService, useValue: mockUserService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: MenuService, useValue: mockMenuService },
      ],
    }).compile();

    handler = module.get<CommandHandler>(CommandHandler);
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

  describe('Start Command', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should handle start command for existing user', async () => {
      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(mockUserData);

      await handler.processCommand(mockCtx, BotCommand.Start);

      expect(mockAuthUserService.findByPlatformId).toHaveBeenCalledWith(mockUserId);
      expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('Welcome back, Test!'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.any(Array),
          }),
        }),
      );

      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          conversationState: expect.objectContaining({
            context: expect.objectContaining({
              firstVisit: false,
              authenticated: true,
            }),
          }),
        }),
      );
    });

    it('should handle start command for new user', async () => {
      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(null);

      await handler.processCommand(mockCtx, BotCommand.Start);

      expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('Welcome to MotivBuy!'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '✅ Complete Setup',
                  callback_data: 'auth:register',
                }),
              ]),
            ]),
          }),
        }),
      );

      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          conversationState: expect.objectContaining({
            context: expect.objectContaining({
              firstVisit: true,
              authenticated: false,
            }),
          }),
        }),
      );
    });

    it('should handle start command errors gracefully', async () => {
      mockAuthUserService.findByPlatformId.mockRejectedValueOnce(new Error('Database error'));

      await handler.processCommand(mockCtx, BotCommand.Start);

      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Welcome to MotivBuy!'));
    });

    it('should handle start command without user context', async () => {
      mockCtx.from = null;

      await handler.processCommand(mockCtx, BotCommand.Start);

      expect(mockAuthUserService.findByPlatformId).not.toHaveBeenCalled();
    });
  });

  describe('Help Command', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should display comprehensive help information', async () => {
      await handler.processCommand(mockCtx, BotCommand.Help);

      expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('🤖 MotivBuy Bot Help Center'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '📞 Contact Support',
                  callback_data: 'help:contact',
                }),
              ]),
            ]),
          }),
        }),
      );

      const helpCall = mockCtx.replyWithHTML.mock.calls[0];
      const helpText = helpCall[0];

      expect(helpText).toContain('Available Commands');
      expect(helpText).toContain('Main Features');
      expect(helpText).toContain('Quick Actions');
      expect(helpText).toContain('Tips');
      expect(helpText).toContain('Need Help');
    });
  });

  describe('Balance Command', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should display balance information successfully', async () => {
      const mockBalance = createMockBalance();
      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(mockUserData);
      mockBalanceService.getUserBalance.mockResolvedValueOnce(mockBalance);

      await handler.processCommand(mockCtx, BotCommand.Balance);

      expect(mockAuthUserService.findByPlatformId).toHaveBeenCalledWith(mockUserId);
      expect(mockBalanceService.getUserBalance).toHaveBeenCalledWith(mockUserData.id);

      expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('💰 Your Balance'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '💸 Withdraw',
                  callback_data: 'menu:withdrawal',
                }),
              ]),
            ]),
          }),
        }),
      );

      const balanceCall = mockCtx.replyWithHTML.mock.calls[0];
      const balanceText = balanceCall[0];

      expect(balanceText).toContain('$100.50'); // Available balance
      expect(balanceText).toContain('$25.00'); // Pending balance
      expect(balanceText).toContain('$500.00'); // Total earned
    });

    it('should handle user not found', async () => {
      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(null);

      await handler.processCommand(mockCtx, BotCommand.Balance);

      expect(mockCtx.reply).toHaveBeenCalledWith('User not found. Please use /start to register.');
    });

    it('should handle balance service errors', async () => {
      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(mockUserData);
      mockBalanceService.getUserBalance.mockRejectedValueOnce(new Error('Balance error'));

      await handler.processCommand(mockCtx, BotCommand.Balance);

      expect(mockCtx.reply).toHaveBeenCalledWith('Unable to fetch balance information. Please try again later.');
    });

    it('should require authentication', async () => {
      mockCtx.from = null;

      await handler.processCommand(mockCtx, BotCommand.Balance);

      expect(mockCtx.reply).toHaveBeenCalledWith('🔒 Authentication required.\n\nPlease use /start to begin.');
    });
  });

  describe('Profile Command', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should navigate to profile menu', async () => {
      await handler.processCommand(mockCtx, BotCommand.Profile);

      expect(mockMenuService.navigateToMenu).toHaveBeenCalledWith(mockCtx, MenuType.Profile);
    });

    it('should require authentication', async () => {
      mockCtx.from = null;

      await handler.processCommand(mockCtx, BotCommand.Profile);

      expect(mockMenuService.navigateToMenu).not.toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Authentication required'));
    });
  });

  describe('Settings Command', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should navigate to settings menu', async () => {
      await handler.processCommand(mockCtx, BotCommand.Settings);

      expect(mockMenuService.navigateToMenu).toHaveBeenCalledWith(mockCtx, MenuType.Settings);
    });
  });

  describe('Admin Command', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should allow admin access', async () => {
      const adminUser = { ...mockUserData, isAdmin: true };
      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(adminUser);

      await handler.processCommand(mockCtx, BotCommand.Admin);

      expect(mockMenuService.navigateToMenu).toHaveBeenCalledWith(mockCtx, MenuType.Admin);
    });

    it('should deny non-admin access', async () => {
      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(mockUserData);

      await handler.processCommand(mockCtx, BotCommand.Admin);

      expect(mockCtx.reply).toHaveBeenCalledWith('❌ Access denied. Admin privileges required.');
      expect(mockMenuService.navigateToMenu).not.toHaveBeenCalled();
    });

    it('should handle admin check errors', async () => {
      mockAuthUserService.findByPlatformId.mockRejectedValueOnce(new Error('Database error'));

      await handler.processCommand(mockCtx, BotCommand.Admin);

      expect(mockCtx.reply).toHaveBeenCalledWith('❌ Unable to verify admin access. Please try again later.');
    });
  });

  describe('Cancel Command', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should cancel operation and clear session', async () => {
      await handler.processCommand(mockCtx, BotCommand.Cancel);

      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          conversationState: expect.objectContaining({
            currentStep: 'main_menu',
            context: { cancelled: true },
          }),
          formData: {},
        }),
      );

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('❌ Operation cancelled'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '📋 Main Menu',
                  callback_data: 'menu:main',
                }),
              ]),
            ]),
          }),
        }),
      );
    });

    it('should handle cancel without user context', async () => {
      mockCtx.from = null;

      await handler.processCommand(mockCtx, BotCommand.Cancel);

      expect(mockSessionService.updateSession).not.toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('❌ Operation cancelled'));
    });
  });

  describe('Support Command', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should display support information', async () => {
      await handler.processCommand(mockCtx, BotCommand.Support);

      expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('🆘 Support & Contact'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '💬 Contact Support',
                  url: 'https://t.me/motivbuy_support',
                }),
              ]),
            ]),
          }),
        }),
      );

      const supportCall = mockCtx.replyWithHTML.mock.calls[0];
      const supportText = supportCall[0];

      expect(supportText).toContain('Contact Methods');
      expect(supportText).toContain('Quick Help');
      expect(supportText).toContain('Support Hours');
      expect(supportText).toContain(mockUserId); // User ID should be included
    });
  });

  describe('Status Command', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should display comprehensive status information', async () => {
      const mockBalance = createMockBalance();
      const mockSession = {
        data: {
          navigationState: { currentLocation: 'main' },
          preferences: {
            notifications: { enablePush: true },
            language: 'en',
          },
        },
        updatedAt: new Date('2023-06-01T12:00:00Z'),
      };

      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(mockUserData);
      mockSessionService.getSession.mockResolvedValueOnce(mockSession);
      mockBalanceService.getUserBalance.mockResolvedValueOnce(mockBalance);

      await handler.processCommand(mockCtx, BotCommand.Status);

      expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('📊 Account Status'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '🔄 Refresh Status',
                  callback_data: 'status:refresh',
                }),
              ]),
            ]),
          }),
        }),
      );

      const statusCall = mockCtx.replyWithHTML.mock.calls[0];
      const statusText = statusCall[0];

      expect(statusText).toContain('Profile Information');
      expect(statusText).toContain('Account Status');
      expect(statusText).toContain('Financial Status');
      expect(statusText).toContain('Session Info');
      expect(statusText).toContain('✅ Active'); // User is active
    });

    it('should handle status errors', async () => {
      mockAuthUserService.findByPlatformId.mockRejectedValueOnce(new Error('Database error'));

      await handler.processCommand(mockCtx, BotCommand.Status);

      expect(mockCtx.reply).toHaveBeenCalledWith('Unable to fetch status information. Please try again later.');
    });
  });

  describe('Language Command', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should display language selection menu', async () => {
      await handler.processCommand(mockCtx, BotCommand.Language);

      expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('🌍 Language Settings'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '🇺🇸 English',
                  callback_data: 'settings:language:en',
                }),
                expect.objectContaining({
                  text: '🇪🇸 Español',
                  callback_data: 'settings:language:es',
                }),
              ]),
            ]),
          }),
        }),
      );
    });
  });

  describe('Verification Command', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should display verification options', async () => {
      await handler.processCommand(mockCtx, BotCommand.Verify);

      expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('✅ Account Verification'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '📧 Verify Email',
                  callback_data: 'verify:email',
                }),
              ]),
            ]),
          }),
        }),
      );

      const verifyCall = mockCtx.replyWithHTML.mock.calls[0];
      const verifyText = verifyCall[0];

      expect(verifyText).toContain('Current Status');
      expect(verifyText).toContain('Verification Benefits');
      expect(verifyText).toContain('Required Documents');
    });
  });

  describe('Export Command', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should display export options', async () => {
      await handler.processCommand(mockCtx, BotCommand.Export);

      expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('📥 Data Export'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '💰 Transactions',
                  callback_data: 'export:transactions',
                }),
              ]),
            ]),
          }),
        }),
      );
    });
  });

  describe('Reset Command', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should display reset options with warning', async () => {
      await handler.processCommand(mockCtx, BotCommand.Reset);

      expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Reset Account Data'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '🗂️ Reset Session Data',
                  callback_data: 'reset:session',
                }),
              ]),
            ]),
          }),
        }),
      );

      const resetCall = mockCtx.replyWithHTML.mock.calls[0];
      const resetText = resetCall[0];

      expect(resetText).toContain('⚠️ WARNING');
      expect(resetText).toContain('What can be reset');
      expect(resetText).toContain('What remains unchanged');
    });
  });

  describe('Unknown Command', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should handle unknown commands gracefully', async () => {
      const unknownCommand = 'unknown_command' as BotCommand;

      await handler.processCommand(mockCtx, unknownCommand);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining(`I don't understand the command "${unknownCommand}"`),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '❓ Help',
                  callback_data: 'menu:help',
                }),
                expect.objectContaining({
                  text: '📋 Main Menu',
                  callback_data: 'menu:main',
                }),
              ]),
            ]),
          }),
        }),
      );
    });
  });

  describe('Error Handling', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should handle command processing errors in development', async () => {
      process.env.NODE_ENV = 'development';
      mockAuthUserService.findByPlatformId.mockRejectedValueOnce(new Error('Test error'));

      await handler.processCommand(mockCtx, BotCommand.Profile);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Command processing error',
        expect.objectContaining({
          command: BotCommand.Profile,
          userId: parseInt(mockUserId),
          error: 'Test error',
        }),
      );

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Error processing command /profile: Test error'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '🔄 Try Again',
                  callback_data: `command:${BotCommand.Profile}`,
                }),
              ]),
            ]),
          }),
        }),
      );
    });

    it('should handle command processing errors in production', async () => {
      process.env.NODE_ENV = 'production';
      mockAuthUserService.findByPlatformId.mockRejectedValueOnce(new Error('Test error'));

      await handler.processCommand(mockCtx, BotCommand.Profile);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Sorry, something went wrong processing your request'),
        expect.any(Object),
      );
    });

    it('should handle reply errors during error handling', async () => {
      mockAuthUserService.findByPlatformId.mockRejectedValueOnce(new Error('Test error'));
      mockCtx.reply.mockRejectedValueOnce(new Error('Reply failed'));

      await handler.processCommand(mockCtx, BotCommand.Profile);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to send error message',
        expect.objectContaining({
          originalError: 'Test error',
          replyError: 'Reply failed',
        }),
      );
    });
  });

  describe('User Activity Tracking', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should update user activity for authenticated commands', async () => {
      await handler.processCommand(mockCtx, BotCommand.Help);

      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          conversationState: expect.objectContaining({
            currentStep: `command_${BotCommand.Help}`,
            context: expect.objectContaining({
              lastCommand: BotCommand.Help,
              lastCommandAt: expect.any(String),
            }),
          }),
        }),
      );
    });

    it('should handle activity update errors gracefully', async () => {
      mockSessionService.updateSession.mockRejectedValueOnce(new Error('Update failed'));

      await handler.processCommand(mockCtx, BotCommand.Help);

      // Should not fail command processing
      expect(mockCtx.replyWithHTML).toHaveBeenCalled();
    });

    it('should not update activity for unauthenticated commands', async () => {
      mockCtx.from = null;

      await handler.processCommand(mockCtx, BotCommand.Profile);

      expect(mockSessionService.updateSession).not.toHaveBeenCalled();
    });
  });

  describe('Authentication Checks', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should pass authentication check with valid user', async () => {
      const checkAuth = (handler as any).checkAuthentication;
      const result = await checkAuth.call(handler, mockCtx);

      expect(result).toBe(true);
    });

    it('should fail authentication check without user', async () => {
      mockCtx.from = null;
      const checkAuth = (handler as any).checkAuthentication;
      const result = await checkAuth.call(handler, mockCtx);

      expect(result).toBe(false);
      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('🔒 Authentication required'));
    });
  });

  describe('Performance and Load Testing', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should handle concurrent command processing', async () => {
      const commands = [BotCommand.Help, BotCommand.Menu, BotCommand.Stats, BotCommand.Traffic, BotCommand.Campaign];

      const promises = commands.map((command) => handler.processCommand(mockCtx, command));

      await Promise.all(promises);

      expect(mockCtx.replyWithHTML || mockCtx.reply).toHaveBeenCalledTimes(commands.length);
    });

    it('should process commands under performance threshold', async () => {
      const start = performance.now();
      await handler.processCommand(mockCtx, BotCommand.Help);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100); // Should process under 100ms
    });
  });

  describe('Menu Navigation Commands', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should navigate to stats menu', async () => {
      await handler.processCommand(mockCtx, BotCommand.Stats);
      expect(mockMenuService.navigateToMenu).toHaveBeenCalledWith(mockCtx, MenuType.Statistics);
    });

    it('should navigate to campaign menu', async () => {
      await handler.processCommand(mockCtx, BotCommand.Campaign);
      expect(mockMenuService.navigateToMenu).toHaveBeenCalledWith(mockCtx, MenuType.Campaign);
    });

    it('should navigate to withdraw menu', async () => {
      await handler.processCommand(mockCtx, BotCommand.Withdraw);
      expect(mockMenuService.navigateToMenu).toHaveBeenCalledWith(mockCtx, MenuType.Withdrawal);
    });

    it('should navigate to referral menu', async () => {
      await handler.processCommand(mockCtx, BotCommand.Referral);
      expect(mockMenuService.navigateToMenu).toHaveBeenCalledWith(mockCtx, MenuType.Referral);
    });

    it('should navigate to traffic menu', async () => {
      await handler.processCommand(mockCtx, BotCommand.Traffic);
      expect(mockMenuService.navigateToMenu).toHaveBeenCalledWith(mockCtx, MenuType.Traffic);
    });

    it('should navigate to main menu', async () => {
      await handler.processCommand(mockCtx, BotCommand.Menu);
      expect(mockMenuService.navigateToMenu).toHaveBeenCalledWith(mockCtx, MenuType.Main);
    });
  });

  describe('Edge Cases', () => {
    let mockCtx: BotContext;

    beforeEach(() => {
      mockCtx = createMockBotContext();
    });

    it('should handle context without from.id for balance command', async () => {
      mockCtx.from!.id = undefined as any;

      await handler.processCommand(mockCtx, BotCommand.Balance);

      expect(mockAuthUserService.findByPlatformId).not.toHaveBeenCalled();
    });

    it('should handle missing user data gracefully', async () => {
      mockCtx.from = {
        id: parseInt(mockUserId),
        first_name: undefined as any,
      } as any;

      await handler.processCommand(mockCtx, BotCommand.Start);

      // Should still work with default values
      expect(mockCtx.replyWithHTML || mockCtx.reply).toHaveBeenCalled();
    });
  });
});
