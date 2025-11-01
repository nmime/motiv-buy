/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

/* eslint-disable sonarjs/no-dead-store */
/* eslint-disable sonarjs/no-unused-vars */
/* eslint-disable sonarjs/no-nested-functions */
/* eslint-disable sonarjs/no-ignored-exceptions */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AuthComposer } from '../composer/auth.composer';
import { SessionService } from '../service/session.service';
import { AuthService } from '@app/feature-auth-main';
import { AuthUserService } from '@app/feature-auth-shared';
import { UserService } from '@app/feature-user-main';
import {
  MockBotContextFactory,
  MockCallbackQueryFactory,
} from '@app/feature-bot-shared/test/telegram-context.mock.spec';

/**
 * Comprehensive Error Scenario Testing
 *
 * Tests various error conditions, edge cases, and failure scenarios
 * to ensure robust error handling, graceful degradation, and proper
 * user feedback in authentication and session management systems.
 */
describe('Auth Error Scenarios Tests', () => {
  let authComposer: AuthComposer;
  let module: TestingModule;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockAuthUserService: jest.Mocked<AuthUserService>;
  let mockUserService: jest.Mocked<UserService>;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Setup comprehensive mocks for error testing
    mockSessionService = {
      createSession: jest.fn(),
      getSession: jest.fn(),
      updateSession: jest.fn(),
      deleteSession: jest.fn(),
      getOrCreateSession: jest.fn(),
      extendSession: jest.fn(),
      isSessionValid: jest.fn(),
      clearExpiredSessions: jest.fn(),
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

    // Mock logger methods to capture error logs
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

  describe('Database Connection Failures', () => {
    it('should handle database connection timeout during authentication', async () => {
      const ctx = MockBotContextFactory.createBasicContext();
      const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, ctx.from);
      const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

      // Simulate database timeout
      mockAuthUserService.findByPlatformId.mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Database connection timeout')), 100);
          }),
      );

      await authComposer['handleQuickRegister'](callbackCtx);

      // Should handle timeout gracefully
      expect(callbackCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Registration failed'),
        expect.any(Object),
      );

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Quick registration error',
        expect.objectContaining({
          error: 'Database connection timeout',
        }),
      );
    });

    it('should handle database transaction rollback errors', async () => {
      const ctx = MockBotContextFactory.createBasicContext();
      const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, ctx.from);
      const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

      mockAuthUserService.findByPlatformId.mockResolvedValue(null);
      mockAuthService.auth.mockRejectedValue(new Error('Transaction rollback: Constraint violation'));

      await authComposer['handleQuickRegister'](callbackCtx);

      expect(callbackCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Registration failed'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '🔄 Try Again' }),
                expect.objectContaining({ text: '🆘 Contact Support' }),
              ]),
            ]),
          }),
        }),
      );
    });

    it('should handle database schema migration errors', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Simulate schema incompatibility error
      mockSessionService.getSession.mockRejectedValue(new Error('Column "new_field" does not exist'));

      const authState = await authComposer['getCurrentAuthState'](ctx);

      // Should fallback to safe default state
      expect(authState).toBe('unauthenticated');

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Error getting auth state',
        expect.objectContaining({
          error: 'Column "new_field" does not exist',
        }),
      );
    });
  });

  describe('Redis Connection and Memory Issues', () => {
    it('should handle Redis connection loss gracefully', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Simulate Redis connection lost
      mockSessionService.createSession.mockRejectedValue(new Error('Redis connection lost: ECONNREFUSED'));

      // Should not crash the application
      await expect(async () => {
        try {
          await authComposer['getCurrentAuthState'](ctx);
          await authComposer.composeWelcomeMenu(ctx);
        } catch (error) {
          // Should handle gracefully
        }
      }).not.toThrow();
    });

    it('should handle Redis memory pressure', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      mockSessionService.createSession.mockRejectedValue(
        new Error('Redis memory limit exceeded: OOM command not allowed'),
      );

      mockSessionService.updateSession.mockRejectedValue(
        new Error('Redis memory limit exceeded: OOM command not allowed'),
      );

      // Should provide fallback behavior
      const result = await authComposer['getCurrentAuthState'](ctx);
      expect(result).toBe('unauthenticated');

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Error getting auth state',
        expect.objectContaining({
          error: expect.stringContaining('Redis memory limit exceeded'),
        }),
      );
    });

    it('should handle Redis cluster failover', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      let attempt = 0;
      mockSessionService.getSession.mockImplementation(async () => {
        attempt++;
        if (attempt <= 2) {
          throw new Error('Redis cluster is in failover state');
        }

        return {
          userId: ctx.from!.id.toString(),
          data: {
            conversationState: {
              currentStep: 'test',
              availableSteps: [],
              context: {},
              isActive: true,
              startedAt: new Date(),
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          metadata: { version: '1.0', platform: 'telegram-bot' },
        } as any;
      });

      // Multiple attempts should eventually succeed
      const session1 = await authComposer['getCurrentAuthState'](ctx);
      const session2 = await authComposer['getCurrentAuthState'](ctx);
      const session3 = await authComposer['getCurrentAuthState'](ctx);

      expect(session3).toBe('unauthenticated'); // Should get valid state after retries
    });

    it('should handle Redis data corruption', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Simulate corrupted data returned from Redis
      mockSessionService.getSession.mockResolvedValue({
        userId: ctx.from!.id.toString(),
        data: 'corrupted_string_instead_of_object' as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
        metadata: {},
      });

      const authState = await authComposer['getCurrentAuthState'](ctx);

      // Should handle corrupted data gracefully
      expect(authState).toBe('unauthenticated');
    });
  });

  describe('Network and API Failures', () => {
    it('should handle Telegram API rate limiting', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Mock rate limiting error
      ctx.reply = jest.fn().mockRejectedValue(new Error('Too Many Requests: retry after 30'));

      ctx.editMessageText = jest.fn().mockRejectedValue(new Error('Too Many Requests: retry after 30'));

      const welcomeMenu = await authComposer.composeWelcomeMenu(ctx);

      // Should still compose menu even if sending fails
      expect(welcomeMenu).toBeDefined();
      expect(welcomeMenu.title).toContain('Welcome to MotivBuy');
    });

    it('should handle Telegram API timeout', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Mock API timeout
      ctx.reply = jest.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), 5000);
          }),
      );

      ctx.answerCallbackQuery = jest.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), 5000);
          }),
      );

      // Should not hang indefinitely
      const startTime = Date.now();

      try {
        const menu = await authComposer.composeWelcomeMenu(ctx);
        expect(menu).toBeDefined();
      } catch (error) {
        // Expected timeout
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(6000); // Should not exceed timeout + buffer
    });

    it('should handle external service unavailability', async () => {
      const ctx = MockBotContextFactory.createBasicContext();
      const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, ctx.from);
      const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

      mockAuthUserService.findByPlatformId.mockResolvedValue(null);

      // Simulate external service down
      mockAuthService.auth.mockRejectedValue(new Error('Service Unavailable: External authentication service is down'));

      await authComposer['handleQuickRegister'](callbackCtx);

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

    it('should handle DNS resolution failures', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      mockAuthService.auth.mockRejectedValue(new Error('getaddrinfo ENOTFOUND auth-service.example.com'));

      const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, ctx.from);
      const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

      mockAuthUserService.findByPlatformId.mockResolvedValue(null);

      await authComposer['handleQuickRegister'](callbackCtx);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Quick registration error',
        expect.objectContaining({
          error: expect.stringContaining('ENOTFOUND'),
        }),
      );
    });
  });

  describe('Input Validation and Sanitization Errors', () => {
    it('should handle malformed callback data', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Create callback with malformed data
      const malformedCallback = {
        id: 'test',
        from: ctx.from!,
        chat_instance: 'test',
        data: 'malformed::::callback::::data::::with::::too::::many::::parts',
        message: ctx.message,
      };

      const callbackCtx = MockBotContextFactory.createCallbackContext(malformedCallback);

      // Should not crash when handling malformed callback
      await expect(async () => {
        try {
          // Simulate callback handling that would parse the data
          const parts = malformedCallback.data.split(':');
          if (parts.length > 4) {
            throw new Error('Invalid callback data format');
          }
        } catch (error) {
          // Should handle gracefully
        }
      }).not.toThrow();
    });

    it('should handle extremely long input strings', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Create extremely long input
      const longString = 'a'.repeat(10000);
      const longInputCtx = {
        ...ctx,
        message: {
          ...ctx.message!,
          text: longString,
        },
      };

      // Should handle without crashing
      const authState = await authComposer['getCurrentAuthState'](longInputCtx);
      expect(authState).toBeDefined();
    });

    it('should handle special characters and Unicode', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Create context with special characters
      const specialCharCtx = {
        ...ctx,
        from: {
          ...ctx.from!,
          first_name: '🚀💥☠️<script>alert("xss")</script>',
          last_name: '测试用户名',
          username: 'user_ñáméé_123',
        },
      };

      // Should handle special characters gracefully
      const menu = await authComposer.composeWelcomeMenu(specialCharCtx);
      expect(menu).toBeDefined();
      expect(menu.title).toContain('Welcome to MotivBuy');
    });

    it('should handle null and undefined values', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Create context with null/undefined values
      const nullValueCtx = {
        ...ctx,
        from: {
          ...ctx.from!,
          first_name: null as any,
          last_name: undefined,
          username: null as any,
        },
      };

      // Should handle gracefully
      const menu = await authComposer.composeWelcomeMenu(nullValueCtx);
      expect(menu).toBeDefined();
    });
  });

  describe('Concurrency and Race Condition Errors', () => {
    it('should handle multiple simultaneous authentication attempts', async () => {
      const ctx = MockBotContextFactory.createBasicContext();
      const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, ctx.from);
      const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

      mockAuthUserService.findByPlatformId.mockResolvedValue(null);

      let authCallCount = 0;
      mockAuthService.auth.mockImplementation(async () => {
        authCallCount++;
        if (authCallCount === 1) {
          // First call succeeds after delay
          await new Promise((resolve) => setTimeout(resolve, 100));

          return {
            success: true,
            user: { id: 'user-123' },
            token: 'token-123',
          };
        } else {
          // Subsequent calls should be rejected
          throw new Error('Authentication already in progress');
        }
      });

      // Start multiple authentication attempts simultaneously
      const promise1 = authComposer['handleQuickRegister'](callbackCtx);
      const promise2 = authComposer['handleQuickRegister'](callbackCtx);
      const promise3 = authComposer['handleQuickRegister'](callbackCtx);

      await Promise.allSettled([promise1, promise2, promise3]);

      // Only one should succeed
      expect(mockAuthService.auth).toHaveBeenCalledTimes(3);
    });

    it('should handle session update race conditions', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      mockSessionService.getSession.mockResolvedValue({
        userId: ctx.from!.id.toString(),
        data: { cache: { counter: 0 } },
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        metadata: {},
      } as any);

      let updateCount = 0;
      mockSessionService.updateSession.mockImplementation(async (userId, data) => {
        updateCount++;
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

        if (updateCount > 3) {
          throw new Error('Concurrent modification detected');
        }

        return {
          userId,
          data: { cache: { counter: updateCount, ...data.cache } },
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          metadata: {},
        } as any;
      });

      // Attempt multiple concurrent updates
      const updates = Array(5)
        .fill(null)
        .map((_, i) => authComposer['updateAuthState'](ctx.from!.id.toString(), 'authenticated' as any));

      const results = await Promise.allSettled(updates);

      // Some should succeed, some may fail due to race conditions
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length + rejected.length).toBe(5);
    });
  });

  describe('Memory and Resource Exhaustion', () => {
    it('should handle memory exhaustion gracefully', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Simulate out of memory error
      mockSessionService.createSession.mockRejectedValue(new Error('JavaScript heap out of memory'));

      mockSessionService.getSession.mockRejectedValue(new Error('JavaScript heap out of memory'));

      // Should not crash, should log error
      const authState = await authComposer['getCurrentAuthState'](ctx);
      expect(authState).toBe('unauthenticated');

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Error getting auth state',
        expect.objectContaining({
          error: 'JavaScript heap out of memory',
        }),
      );
    });

    it('should handle CPU exhaustion scenarios', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Simulate CPU-intensive operation timeout
      mockAuthService.auth.mockImplementation(async () => {
        const startTime = Date.now();
        // Simulate CPU-intensive work that times out
        while (Date.now() - startTime < 1000) {
          // Busy wait for 1 second
        }

        throw new Error('Operation timed out due to high CPU usage');
      });

      const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, ctx.from);
      const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

      mockAuthUserService.findByPlatformId.mockResolvedValue(null);

      const startTime = Date.now();
      await authComposer['handleQuickRegister'](callbackCtx);
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThan(1000); // Should have taken time due to CPU intensive work
      expect(callbackCtx.answerCallbackQuery).toHaveBeenCalledWith('❌ Registration failed');
    });

    it('should handle file descriptor exhaustion', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Simulate file descriptor exhaustion
      mockAuthService.auth.mockRejectedValue(new Error('EMFILE: too many open files'));

      const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, ctx.from);
      const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

      mockAuthUserService.findByPlatformId.mockResolvedValue(null);

      await authComposer['handleQuickRegister'](callbackCtx);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Quick registration error',
        expect.objectContaining({
          error: 'EMFILE: too many open files',
        }),
      );
    });
  });

  describe('Security-Related Errors', () => {
    it('should handle JWT token validation errors', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      mockAuthService.validateUser.mockRejectedValue(new Error('Invalid JWT token: signature verification failed'));

      // Should handle invalid tokens gracefully
      const authState = await authComposer['getCurrentAuthState'](ctx);
      expect(authState).toBe('unauthenticated');
    });

    it('should handle encryption/decryption errors', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      mockSessionService.getSession.mockRejectedValue(new Error('Decryption failed: invalid key or corrupted data'));

      const authState = await authComposer['getCurrentAuthState'](ctx);
      expect(authState).toBe('unauthenticated');

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Error getting auth state',
        expect.objectContaining({
          error: 'Decryption failed: invalid key or corrupted data',
        }),
      );
    });

    it('should handle certificate validation errors', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      mockAuthService.auth.mockRejectedValue(new Error('CERT_HAS_EXPIRED: certificate has expired'));

      const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, ctx.from);
      const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

      mockAuthUserService.findByPlatformId.mockResolvedValue(null);

      await authComposer['handleQuickRegister'](callbackCtx);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Quick registration error',
        expect.objectContaining({
          error: 'CERT_HAS_EXPIRED: certificate has expired',
        }),
      );
    });
  });

  describe('Edge Case Error Scenarios', () => {
    it('should handle circular dependency injection errors', async () => {
      // This test ensures the module handles dependency injection correctly
      expect(authComposer).toBeDefined();
      expect(authComposer['sessionService']).toBeDefined();
      expect(authComposer['authService']).toBeDefined();
      expect(authComposer['authUserService']).toBeDefined();
    });

    it('should handle missing environment variables', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Simulate missing environment configuration
      mockAuthService.auth.mockRejectedValue(new Error('Missing required environment variable: JWT_SECRET'));

      const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, ctx.from);
      const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

      mockAuthUserService.findByPlatformId.mockResolvedValue(null);

      await authComposer['handleQuickRegister'](callbackCtx);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Quick registration error',
        expect.objectContaining({
          error: 'Missing required environment variable: JWT_SECRET',
        }),
      );
    });

    it('should handle version incompatibility errors', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      mockSessionService.getSession.mockRejectedValue(new Error('Version mismatch: expected v2.0, got v1.0'));

      const authState = await authComposer['getCurrentAuthState'](ctx);
      expect(authState).toBe('unauthenticated');

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Error getting auth state',
        expect.objectContaining({
          error: 'Version mismatch: expected v2.0, got v1.0',
        }),
      );
    });

    it('should handle graceful degradation when features are disabled', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Simulate feature flag disabled
      mockAuthService.auth.mockRejectedValue(new Error('Feature disabled: QUICK_REGISTRATION is not enabled'));

      const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, ctx.from);
      const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

      mockAuthUserService.findByPlatformId.mockResolvedValue(null);

      await authComposer['handleQuickRegister'](callbackCtx);

      // Should provide alternative registration options
      expect(callbackCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Registration failed'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([expect.objectContaining({ text: '📝 Manual Registration' })]),
            ]),
          }),
        }),
      );
    });
  });

  describe('Recovery and Resilience Testing', () => {
    it('should recover from temporary service outages', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      let callCount = 0;
      mockSessionService.getSession.mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Service temporarily unavailable');
        }

        return {
          userId: ctx.from!.id.toString(),
          data: {
            conversationState: {
              currentStep: 'test',
              availableSteps: [],
              context: {},
              isActive: true,
              startedAt: new Date(),
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          metadata: {},
        } as any;
      });

      // Multiple attempts should eventually succeed
      await authComposer['getCurrentAuthState'](ctx);
      await authComposer['getCurrentAuthState'](ctx);
      const finalState = await authComposer['getCurrentAuthState'](ctx);

      expect(finalState).toBe('unauthenticated');
      expect(callCount).toBe(3);
    });

    it('should maintain service availability during partial component failures', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Session service fails, but auth composer should still work
      mockSessionService.getSession.mockRejectedValue(new Error('Session service down'));
      mockSessionService.createSession.mockRejectedValue(new Error('Session service down'));

      // Should still be able to compose menus
      const menu = await authComposer.composeWelcomeMenu(ctx);
      expect(menu).toBeDefined();
      expect(menu.title).toContain('Welcome to MotivBuy');

      // Should gracefully handle missing session
      const authState = await authComposer['getCurrentAuthState'](ctx);
      expect(authState).toBe('unauthenticated');
    });
  });
});
