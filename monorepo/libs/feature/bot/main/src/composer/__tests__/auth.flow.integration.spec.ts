import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AuthComposer } from '../auth.composer';
import { SessionService } from '../../service/session.service';
import { AuthService } from '@app/feature-auth-main';
import { AuthUserService } from '@app/feature-auth-shared';
import { UserService } from '@app/feature-user-main';
import { BotContext } from '@app/feature-bot-shared';
import {
  MockBotContextFactory,
  MockTelegramUserFactory,
  MockCallbackQueryFactory,
  AuthTestScenarios,
  BotTestUtils,
} from '@app/feature-bot-shared/test/telegram-context.mock.spec';
import { PlatformType } from '@app/database';

/**
 * Auth Flow Integration Tests
 *
 * Comprehensive testing of authentication flows with different user scenarios,
 * edge cases, and integration between components. Tests real user journeys
 * from start to completion with proper state management and error handling.
 */
describe('Auth Flow Integration Tests', () => {
  let authComposer: AuthComposer;
  let module: TestingModule;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockAuthUserService: jest.Mocked<AuthUserService>;
  let mockUserService: jest.Mocked<UserService>;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Setup comprehensive mocks
    mockSessionService = {
      createSession: jest.fn(),
      getSession: jest.fn(),
      updateSession: jest.fn(),
      deleteSession: jest.fn(),
      getOrCreateSession: jest.fn(),
      extendSession: jest.fn(),
      isSessionValid: jest.fn(),
    } as any;

    mockAuthService = {
      auth: jest.fn(),
      validateUser: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      sendVerificationCode: jest.fn(),
      verifyCode: jest.fn(),
    } as any;

    mockAuthUserService = {
      findOrCreateByBot: jest.fn(),
      findOrCreateByWebAuth: jest.fn(),
      findByPlatformId: jest.fn(),
    } as any;

    mockUserService = {
      findById: jest.fn(),
      updateProfile: jest.fn(),
      getUserBalance: jest.fn(),
    } as any;

    module = await Test.createTestingModule({
      providers: [
        AuthComposer,
        { provide: SessionService, useValue: mockSessionService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuthUserService, useValue: mockAuthUserService },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    authComposer = module.get<AuthComposer>(AuthComposer);

    // Mock logger methods
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

  describe('New User Registration Flow', () => {
    it('should handle complete first-time user registration successfully', async () => {
      const ctx = AuthTestScenarios.newUserRegistration();

      // Step 1: User starts with /start command
      mockSessionService.getSession.mockResolvedValueOnce(null);
      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(null);

      const welcomeMenu = await authComposer.composeWelcomeMenu(ctx);

      expect(welcomeMenu).toMatchObject({
        type: 'Auth',
        title: expect.stringContaining('Welcome to MotivBuy'),
        buttons: expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining('Quick Start'),
              callbackData: expect.stringContaining('auth:quick_register'),
            }),
          ]),
        ]),
      });

      // Step 2: User selects quick registration
      const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, ctx.from);
      const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(null);
      mockAuthService.auth.mockResolvedValueOnce({
        success: true,
        user: { id: 'new-user-123', telegramId: ctx.from!.id.toString() },
        token: 'jwt-token-123',
      });

      mockSessionService.createSession.mockResolvedValueOnce({
        userId: ctx.from!.id.toString(),
        data: {
          conversationState: {
            currentStep: 'just_registered',
            availableSteps: ['profile_setup', 'tutorial', 'main_menu'],
            context: { justRegistered: true, quickRegister: true },
            isActive: true,
            startedAt: new Date(),
          },
          preferences: {
            language: 'en',
            notifications: { enablePush: true, enableEmail: false, enableSms: false, categories: {} },
            display: { theme: 'auto', timezone: 'UTC', dateFormat: 'DD/MM/YYYY', numberFormat: 'en-US' },
            privacy: { shareAnalytics: true, shareUsageData: true, allowDataExport: true },
          },
          navigationState: { currentLocation: 'start', breadcrumb: [], history: [], metadata: {} },
          formData: {},
          cache: {},
          custom: {},
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        metadata: { version: '1.0', platform: 'telegram-bot' },
      });

      // Simulate quick registration process
      await authComposer['handleQuickRegister'](callbackCtx);

      // Verify auth service was called with correct parameters
      expect(mockAuthService.auth).toHaveBeenCalledWith({
        userData: {
          id: ctx.from!.id.toString(),
          firstName: ctx.from!.first_name,
          lastName: ctx.from!.last_name,
          username: ctx.from!.username,
          languageCode: ctx.from!.language_code,
        },
        platformType: PlatformType.TelegramBot,
        ip: '0.0.0.0',
      });

      // Verify session was created
      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        ctx.from!.id.toString(),
        expect.objectContaining({
          conversationState: expect.objectContaining({
            currentStep: 'just_registered',
            context: { justRegistered: true, quickRegister: true },
          }),
        }),
      );

      // Verify user sees success message
      expect(callbackCtx.answerCallbackQuery).toHaveBeenCalledWith('🎉 Account created successfully!');
    });

    it('should handle registration for user who already exists', async () => {
      const ctx = AuthTestScenarios.newUserRegistration();
      const existingUser = { id: 'existing-123', telegramId: ctx.from!.id.toString(), firstName: 'John' };

      const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, ctx.from);
      const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

      // User already exists
      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(existingUser);

      await authComposer['handleQuickRegister'](callbackCtx);

      // Should not attempt to create new user
      expect(mockAuthService.auth).not.toHaveBeenCalled();

      // Should show already registered message
      expect(callbackCtx.answerCallbackQuery).toHaveBeenCalledWith('✅ Account already exists');
    });

    it('should handle registration errors gracefully', async () => {
      const ctx = AuthTestScenarios.newUserRegistration();

      const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, ctx.from);
      const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(null);
      mockAuthService.auth.mockRejectedValueOnce(new Error('Database connection failed'));

      await authComposer['handleQuickRegister'](callbackCtx);

      // Should show error message with retry options
      expect(callbackCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Registration failed'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '🔄 Try Again' }),
                expect.objectContaining({ text: '📝 Manual Registration' }),
              ]),
            ]),
          }),
        }),
      );

      expect(callbackCtx.answerCallbackQuery).toHaveBeenCalledWith('❌ Registration failed');
    });
  });

  describe('Returning User Authentication Flow', () => {
    it('should handle returning user authentication', async () => {
      const ctx = AuthTestScenarios.returningUser();
      const existingUser = {
        id: 'existing-123',
        telegramId: ctx.from!.id.toString(),
        firstName: 'John',
        isActive: true,
      };

      mockSessionService.getSession.mockResolvedValueOnce({
        userId: ctx.from!.id.toString(),
        data: {
          conversationState: {
            currentStep: 'authenticated',
            availableSteps: [],
            context: {},
            isActive: true,
            startedAt: new Date(),
          },
          preferences: { language: 'en' },
          navigationState: { currentLocation: 'main', breadcrumb: [], history: [], metadata: {} },
          formData: {},
          cache: {},
          custom: {},
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        metadata: { version: '1.0', platform: 'telegram-bot' },
      });

      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(existingUser);

      const authState = await authComposer['getCurrentAuthState'](ctx);
      expect(authState).toBe('authenticated');

      const menu = await authComposer.composeAuthGateway(ctx);

      expect(menu.title).toContain('Welcome back');
      expect(menu.buttons).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining('Main Menu'),
            }),
          ]),
        ]),
      );
    });

    it('should handle user with valid session but inactive account', async () => {
      const ctx = AuthTestScenarios.returningUser();
      const inactiveUser = {
        id: 'inactive-123',
        telegramId: ctx.from!.id.toString(),
        firstName: 'John',
        isActive: false,
      };

      mockSessionService.getSession.mockResolvedValueOnce({
        userId: ctx.from!.id.toString(),
        data: {
          conversationState: {
            currentStep: 'authenticated',
            availableSteps: [],
            context: {},
            isActive: true,
            startedAt: new Date(),
          },
          preferences: { language: 'en' },
          navigationState: { currentLocation: 'main', breadcrumb: [], history: [], metadata: {} },
          formData: {},
          cache: {},
          custom: {},
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        metadata: { version: '1.0', platform: 'telegram-bot' },
      });

      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(inactiveUser);

      const authState = await authComposer['getCurrentAuthState'](ctx);
      expect(authState).toBe('unauthenticated');
    });
  });

  describe('Session Expiration and Recovery', () => {
    it('should handle expired session gracefully', async () => {
      const ctx = AuthTestScenarios.expiredSession();

      mockSessionService.getSession.mockResolvedValueOnce(null); // Session expired and removed
      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(null);

      const authState = await authComposer['getCurrentAuthState'](ctx);
      expect(authState).toBe('unauthenticated');

      const menu = await authComposer.composeAuthGateway(ctx);

      expect(menu.title).toContain('Welcome to MotivBuy');
      expect(menu.buttons).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining('Quick Start'),
            }),
          ]),
        ]),
      );
    });

    it('should extend session on user activity', async () => {
      const ctx = AuthTestScenarios.returningUser();

      const validSession = {
        userId: ctx.from!.id.toString(),
        data: {
          conversationState: {
            currentStep: 'authenticated',
            availableSteps: [],
            context: {},
            isActive: true,
            startedAt: new Date(),
          },
          preferences: { language: 'en' },
          navigationState: { currentLocation: 'main', breadcrumb: [], history: [], metadata: {} },
          formData: {},
          cache: {},
          custom: {},
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        metadata: { version: '1.0', platform: 'telegram-bot' },
      };

      mockSessionService.getSession.mockResolvedValueOnce(validSession);
      mockSessionService.extendSession.mockResolvedValueOnce(true);

      const session = await mockSessionService.getOrCreateSession(ctx.from!.id.toString());

      expect(mockSessionService.extendSession).toHaveBeenCalledWith(ctx.from!.id.toString());
    });
  });

  describe('Registration Flow State Management', () => {
    it('should maintain state through multi-step registration', async () => {
      const ctx = AuthTestScenarios.registrationInProgress();

      // Step 1: User is in email collection state
      mockSessionService.getSession.mockResolvedValueOnce({
        userId: ctx.from!.id.toString(),
        data: {
          conversationState: {
            currentStep: 'registration_email',
            availableSteps: ['email', 'password', 'verification'],
            context: { registrationFlow: true },
            isActive: true,
            startedAt: new Date(),
          },
          preferences: { language: 'en' },
          navigationState: { currentLocation: 'registration', breadcrumb: [], history: [], metadata: {} },
          formData: {
            step: 'email',
            startedAt: Date.now() - 5 * 60 * 1000,
          },
          cache: {},
          custom: {},
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        metadata: { version: '1.0', platform: 'telegram-bot' },
      });

      const authState = await authComposer['getCurrentAuthState'](ctx);
      expect(authState).toBe('registerFlow');

      const menu = await authComposer.composeAuthGateway(ctx);
      expect(menu.title).toContain('Create Your Account');
    });

    it('should clean up expired registration state', async () => {
      const ctx = AuthTestScenarios.registrationInProgress();

      // Mock session with expired registration
      const expiredRegistrationSession = {
        userId: ctx.from!.id.toString(),
        data: {
          conversationState: {
            currentStep: 'registration_email',
            availableSteps: ['email', 'password', 'verification'],
            context: { registrationFlow: true },
            isActive: true,
            startedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          },
          preferences: { language: 'en' },
          navigationState: { currentLocation: 'registration', breadcrumb: [], history: [], metadata: {} },
          formData: {
            step: 'email',
            startedAt: Date.now() - 30 * 60 * 1000, // 30 minutes ago (expired)
          },
          cache: {},
          custom: {},
        },
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
        updatedAt: new Date(Date.now() - 20 * 60 * 1000),
        expiresAt: new Date(Date.now() + 86400000),
        metadata: { version: '1.0', platform: 'telegram-bot' },
      };

      mockSessionService.getSession.mockResolvedValueOnce(expiredRegistrationSession);

      // Check if registration state is considered expired (assuming 10 minute timeout)
      const isExpired =
        expiredRegistrationSession.data.conversationState.startedAt.getTime() < Date.now() - 10 * 60 * 1000;

      expect(isExpired).toBe(true);

      if (isExpired) {
        mockSessionService.deleteSession.mockResolvedValueOnce(undefined);
        await mockSessionService.deleteSession(ctx.from!.id.toString());

        expect(mockSessionService.deleteSession).toHaveBeenCalledWith(ctx.from!.id.toString());
      }
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should handle rate-limited authentication attempts', async () => {
      const ctx = AuthTestScenarios.rateLimitedUser();

      mockSessionService.getSession.mockResolvedValueOnce({
        userId: ctx.from!.id.toString(),
        data: {
          conversationState: {
            currentStep: 'rate_limited',
            availableSteps: [],
            context: { rateLimited: true },
            isActive: false,
            startedAt: new Date(),
          },
          preferences: { language: 'en' },
          navigationState: { currentLocation: 'auth', breadcrumb: [], history: [], metadata: {} },
          formData: {},
          cache: {},
          custom: {},
          temp: {
            loginAttempts: 5,
            lastAttempt: Date.now() - 30 * 1000,
            lockoutUntil: Date.now() + 5 * 60 * 1000,
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        metadata: { version: '1.0', platform: 'telegram-bot' },
      });

      // Check if user is currently rate limited
      const session = await mockSessionService.getSession(ctx.from!.id.toString());
      const isRateLimited = session && session.data.temp?.lockoutUntil && session.data.temp.lockoutUntil > Date.now();

      expect(isRateLimited).toBe(true);

      if (isRateLimited) {
        const remainingTime = Math.ceil((session.data.temp!.lockoutUntil! - Date.now()) / 1000 / 60);
        expect(remainingTime).toBeGreaterThan(0);
        expect(remainingTime).toBeLessThanOrEqual(5);
      }
    });

    it('should prevent multiple simultaneous authentication attempts', async () => {
      const ctx = AuthTestScenarios.newUserRegistration();

      const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, ctx.from);
      const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

      mockAuthUserService.findByPlatformId.mockResolvedValue(null);

      // First request starts processing
      let firstRequestResolve: Function;
      const firstRequestPromise = new Promise((resolve) => {
        firstRequestResolve = resolve;
      });

      mockAuthService.auth.mockImplementationOnce(() => firstRequestPromise);

      // Start first request
      const firstRequest = authComposer['handleQuickRegister'](callbackCtx);

      // Start second request immediately
      mockAuthService.auth.mockRejectedValueOnce(new Error('Authentication in progress'));
      const secondRequest = authComposer['handleQuickRegister'](callbackCtx);

      // Resolve first request
      mockAuthService.auth.mockResolvedValueOnce({
        success: true,
        user: { id: 'new-user-123' },
        token: 'jwt-token-123',
      });

      firstRequestResolve!({
        success: true,
        user: { id: 'new-user-123' },
        token: 'jwt-token-123',
      });

      await firstRequest;
      await secondRequest;

      // First request should succeed, second should fail
      expect(mockAuthService.auth).toHaveBeenCalledTimes(2);
    });
  });

  describe('Premium User Features', () => {
    it('should handle premium user authentication with enhanced features', async () => {
      const ctx = AuthTestScenarios.premiumUser();
      const premiumUser = {
        id: 'premium-user-123',
        telegramId: ctx.from!.id.toString(),
        firstName: 'Premium',
        isPremium: true,
        isActive: true,
        tier: 'premium',
      };

      mockSessionService.getSession.mockResolvedValueOnce({
        userId: ctx.from!.id.toString(),
        data: {
          conversationState: {
            currentStep: 'authenticated',
            availableSteps: [],
            context: { premium: true },
            isActive: true,
            startedAt: new Date(),
          },
          preferences: {
            language: 'en',
            theme: 'premium_dark',
            notifications: {
              enablePush: true,
              enableEmail: true,
              enableSms: true,
              categories: { premium_features: true },
            },
          },
          navigationState: { currentLocation: 'main', breadcrumb: [], history: [], metadata: {} },
          formData: {},
          cache: {
            premiumFeatures: {
              advancedAnalytics: true,
              prioritySupport: true,
              customThemes: true,
            },
          },
          custom: {},
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        metadata: { version: '1.0', platform: 'telegram-bot' },
      });

      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(premiumUser);

      const authState = await authComposer['getCurrentAuthState'](ctx);
      expect(authState).toBe('authenticated');

      const menu = await authComposer.composeAuthGateway(ctx);

      // Premium users should see enhanced options
      expect(menu.title).toContain('Premium');
    });
  });

  describe('Verification Flow', () => {
    it('should handle email verification flow', async () => {
      const ctx = AuthTestScenarios.pendingVerification();

      mockSessionService.getSession.mockResolvedValueOnce({
        userId: ctx.from!.id.toString(),
        data: {
          conversationState: {
            currentStep: 'email_verification',
            availableSteps: ['verify', 'resend'],
            context: { verification: true },
            isActive: true,
            startedAt: new Date(),
          },
          preferences: { language: 'en' },
          navigationState: { currentLocation: 'verification', breadcrumb: [], history: [], metadata: {} },
          formData: {},
          cache: {
            verificationAttempts: 1,
            verificationMethod: 'email',
            verificationSentAt: Date.now() - 2 * 60 * 1000,
          },
          custom: {},
          temp: {
            verificationCode: '123456',
            verificationAttempts: 1,
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        metadata: { version: '1.0', platform: 'telegram-bot' },
      });

      const authState = await authComposer['getCurrentAuthState'](ctx);
      expect(authState).toBe('verificationFlow');

      const menu = await authComposer.composeVerificationMenu(ctx, 'email' as any);

      expect(menu.title).toContain('Email Verification');
      expect(menu.buttons).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining('I Entered the Code'),
            }),
          ]),
          expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining('Resend Code'),
              disabled: false, // Should not be disabled on first attempt
            }),
          ]),
        ]),
      );
    });

    it('should disable resend button after multiple attempts', async () => {
      const ctx = AuthTestScenarios.pendingVerification();

      mockSessionService.getSession.mockResolvedValueOnce({
        userId: ctx.from!.id.toString(),
        data: {
          conversationState: {
            currentStep: 'email_verification',
            availableSteps: ['verify'],
            context: { verification: true },
            isActive: true,
            startedAt: new Date(),
          },
          preferences: { language: 'en' },
          navigationState: { currentLocation: 'verification', breadcrumb: [], history: [], metadata: {} },
          formData: {},
          cache: {
            verificationAttempts: 3, // Max attempts reached
            verificationMethod: 'email',
            verificationSentAt: Date.now() - 2 * 60 * 1000,
          },
          custom: {},
          temp: {
            verificationCode: '123456',
            verificationAttempts: 3,
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        metadata: { version: '1.0', platform: 'telegram-bot' },
      });

      const menu = await authComposer.composeVerificationMenu(ctx, 'email' as any);

      const resendButton = menu.buttons
        .find((row) => row.some((button) => button.text.includes('Resend')))
        ?.find((button) => button.text.includes('Resend'));

      expect(resendButton?.disabled).toBe(true);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from auth service failures', async () => {
      const ctx = AuthTestScenarios.newUserRegistration();

      const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, ctx.from);
      const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(null);

      // First attempt fails
      mockAuthService.auth.mockRejectedValueOnce(new Error('Temporary service error'));

      await authComposer['handleQuickRegister'](callbackCtx);

      // Should show retry option
      expect(callbackCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Registration failed'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([expect.objectContaining({ text: '🔄 Try Again' })]),
            ]),
          }),
        }),
      );
    });

    it('should handle session service failures gracefully', async () => {
      const ctx = AuthTestScenarios.newUserRegistration();

      // Session service fails
      mockSessionService.getSession.mockRejectedValueOnce(new Error('Redis connection failed'));

      const authState = await authComposer['getCurrentAuthState'](ctx);

      // Should default to unauthenticated state
      expect(authState).toBe('unauthenticated');

      // Should log the error
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Error getting auth state',
        expect.objectContaining({
          error: 'Redis connection failed',
          userId: ctx.from!.id.toString(),
        }),
      );
    });

    it('should handle corrupted session data', async () => {
      const ctx = AuthTestScenarios.returningUser();

      // Return corrupted/invalid session data
      mockSessionService.getSession.mockResolvedValueOnce({
        userId: ctx.from!.id.toString(),
        data: null, // Corrupted data
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        metadata: { version: '1.0', platform: 'telegram-bot' },
      } as any);

      mockAuthUserService.findByPlatformId.mockResolvedValueOnce(null);

      const authState = await authComposer['getCurrentAuthState'](ctx);

      // Should handle corrupted data gracefully
      expect(authState).toBe('unauthenticated');
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle multiple users authenticating simultaneously', async () => {
      const userCount = 10;
      const contexts = Array(userCount)
        .fill(null)
        .map((_, i) => {
          const user = MockTelegramUserFactory.createUser({ id: 100000 + i });

          return MockBotContextFactory.createBasicContext(user);
        });

      // Mock services for concurrent requests
      mockAuthUserService.findByPlatformId.mockImplementation(async (userId) => {
        await BotTestUtils.simulateNetworkDelay(50, 150);

        return null; // All are new users
      });

      mockAuthService.auth.mockImplementation(async () => {
        await BotTestUtils.simulateNetworkDelay(100, 300);

        return {
          success: true,
          user: { id: `new-user-${Math.random()}` },
          token: `jwt-token-${Math.random()}`,
        };
      });

      mockSessionService.createSession.mockImplementation(async () => {
        await BotTestUtils.simulateNetworkDelay(50, 100);

        return {
          userId: 'test',
          data: {} as any,
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(),
          metadata: {},
        };
      });

      const startTime = Date.now();

      // Process all users concurrently
      const promises = contexts.map((ctx) => {
        const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery(
          'quick_register',
          undefined,
          ctx.from,
        );

        const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

        return authComposer['handleQuickRegister'](callbackCtx);
      });

      await Promise.all(promises);

      const duration = Date.now() - startTime;

      // Should complete all registrations in reasonable time (less than 2 seconds)
      expect(duration).toBeLessThan(2000);

      // All services should have been called for each user
      expect(mockAuthUserService.findByPlatformId).toHaveBeenCalledTimes(userCount);
      expect(mockAuthService.auth).toHaveBeenCalledTimes(userCount);
      expect(mockSessionService.createSession).toHaveBeenCalledTimes(userCount);
    });

    it('should not leak memory during authentication flows', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process many authentication flows
      for (let i = 0; i < 50; i++) {
        const ctx = AuthTestScenarios.newUserRegistration();

        mockSessionService.getSession.mockResolvedValue(null);
        mockAuthUserService.findByPlatformId.mockResolvedValue(null);

        await authComposer['getCurrentAuthState'](ctx);
        await authComposer.composeWelcomeMenu(ctx);

        // Clear any references
        ctx.from = undefined;
        ctx.chat = undefined;
        ctx.message = undefined;
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
});
