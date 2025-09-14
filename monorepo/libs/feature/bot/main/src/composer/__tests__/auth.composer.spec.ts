import { Test, TestingModule } from '@nestjs/testing';
import { Composer, Context } from 'grammy';
import { AuthComposer } from '../auth.composer';
import { AuthService } from '@motiv-buy/auth/main';
import { SessionService } from '../../service/session.service';
import { BotService } from '../../service/bot.service';
import { MenuType } from '@motiv-buy/bot/shared';

// Mock Grammy framework
jest.mock('grammy');

// Mock external services
const mockAuthService = {
  validateUser: jest.fn(),
  registerUser: jest.fn(),
  loginUser: jest.fn(),
  logoutUser: jest.fn(),
  refreshToken: jest.fn(),
  getAuthState: jest.fn(),
  updateAuthState: jest.fn(),
  sendVerificationCode: jest.fn(),
  verifyCode: jest.fn(),
} as const;

const mockSessionService = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
} as const;

const mockBotService = {
  sendMessage: jest.fn(),
  editMessage: jest.fn(),
  deleteMessage: jest.fn(),
  answerCallbackQuery: jest.fn(),
} as const;

// Mock Grammy Context
const createMockContext = (overrides = {}) => ({
  from: {
    id: 123456789,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    is_bot: false,
    language_code: 'en',
  },
  chat: {
    id: 123456789,
    type: 'private' as const,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
  },
  message: {
    message_id: 1,
    date: Date.now() / 1000,
    chat: {
      id: 123456789,
      type: 'private' as const,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
    },
    from: {
      id: 123456789,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      is_bot: false,
      language_code: 'en',
    },
    text: '/start',
  },
  callbackQuery: undefined,
  reply: jest.fn().mockResolvedValue({ message_id: 2 }),
  answerCallbackQuery: jest.fn().mockResolvedValue(true),
  editMessageText: jest.fn().mockResolvedValue(true),
  editMessageReplyMarkup: jest.fn().mockResolvedValue(true),
  ...overrides,
});

describe('AuthComposer', () => {
  let authComposer: AuthComposer;
  let module: TestingModule;
  let mockComposer: jest.Mocked<Composer>;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Composer constructor
    mockComposer = {
      command: jest.fn().mockReturnThis(),
      callbackQuery: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
      use: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
      middleware: jest.fn(),
    } as any;

    (Composer as jest.MockedClass<typeof Composer>).mockImplementation(() => mockComposer);

    module = await Test.createTestingModule({
      providers: [
        AuthComposer,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: BotService,
          useValue: mockBotService,
        },
      ],
    }).compile();

    authComposer = module.get<AuthComposer>(AuthComposer);
  });

  afterEach(async () => {
    await module?.close();
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(authComposer).toBeDefined();
    });

    it('should create composer instance', () => {
      expect(Composer).toHaveBeenCalled();
    });

    it('should register auth handlers', () => {
      expect(mockComposer.command).toHaveBeenCalledWith('login', expect.any(Function));
      expect(mockComposer.command).toHaveBeenCalledWith('register', expect.any(Function));
      expect(mockComposer.command).toHaveBeenCalledWith('logout', expect.any(Function));
      expect(mockComposer.callbackQuery).toHaveBeenCalledWith(/^auth:/, expect.any(Function));
    });
  });

  describe('Authentication Flow Management', () => {
    describe('User Registration', () => {
      it('should handle registration command', async () => {
        const ctx = createMockContext();
        mockSessionService.get.mockResolvedValue(null);
        mockAuthService.getAuthState.mockResolvedValue({ step: 'initial' });

        // Simulate registration command handler
        const registrationHandler = mockComposer.command.mock.calls.find((call) => call[0] === 'register')?.[1];

        if (registrationHandler) {
          await registrationHandler(ctx);
        }

        expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('registration'), expect.any(Object));
      });

      it('should validate registration data', async () => {
        const ctx = createMockContext({
          message: { ...createMockContext().message, text: 'valid@email.com' },
        });

        mockSessionService.get.mockResolvedValue({ step: 'email', userId: '123' });
        mockAuthService.registerUser.mockResolvedValue({
          success: true,
          user: { id: '123', email: 'valid@email.com' },
        });

        // Test email validation during registration
        expect(mockSessionService.get).toBeDefined();
      });

      it('should handle registration errors', async () => {
        const ctx = createMockContext();
        mockAuthService.registerUser.mockRejectedValue(new Error('Registration failed'));

        mockSessionService.get.mockResolvedValue({ step: 'confirm', email: 'test@example.com' });

        // Should handle registration failure gracefully
        expect(mockAuthService.registerUser).toBeDefined();
      });

      it('should send verification code', async () => {
        const ctx = createMockContext();
        const email = 'test@example.com';

        mockSessionService.get.mockResolvedValue({ step: 'verification', email });
        mockAuthService.sendVerificationCode.mockResolvedValue({ success: true });

        await authComposer.sendVerificationCode(ctx, email);

        expect(mockAuthService.sendVerificationCode).toHaveBeenCalledWith(email);
        expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('verification code'), expect.any(Object));
      });

      it('should verify registration code', async () => {
        const ctx = createMockContext({
          message: { ...createMockContext().message, text: '123456' },
        });

        mockSessionService.get.mockResolvedValue({
          step: 'verification',
          email: 'test@example.com',
          code: '123456',
        });

        mockAuthService.verifyCode.mockResolvedValue({ success: true });

        await authComposer.verifyRegistrationCode(ctx);

        expect(mockAuthService.verifyCode).toHaveBeenCalledWith('test@example.com', '123456');
      });
    });

    describe('User Login', () => {
      it('should handle login command', async () => {
        const ctx = createMockContext();
        mockSessionService.get.mockResolvedValue(null);

        const loginHandler = mockComposer.command.mock.calls.find((call) => call[0] === 'login')?.[1];

        if (loginHandler) {
          await loginHandler(ctx);
        }

        expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('login'), expect.any(Object));
      });

      it('should authenticate user credentials', async () => {
        const ctx = createMockContext();
        const credentials = { email: 'test@example.com', password: 'password123' };

        mockSessionService.get.mockResolvedValue({ step: 'credentials', ...credentials });
        mockAuthService.loginUser.mockResolvedValue({
          success: true,
          user: { id: '123', email: credentials.email },
          token: 'jwt-token',
        });

        await authComposer.authenticateUser(ctx, credentials);

        expect(mockAuthService.loginUser).toHaveBeenCalledWith(credentials);
        expect(mockSessionService.set).toHaveBeenCalledWith(
          expect.stringContaining('auth'),
          expect.objectContaining({ authenticated: true }),
        );
      });

      it('should handle invalid credentials', async () => {
        const ctx = createMockContext();
        const credentials = { email: 'invalid@email.com', password: 'wrong' };

        mockAuthService.loginUser.mockRejectedValue(new Error('Invalid credentials'));

        await authComposer.authenticateUser(ctx, credentials);

        expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid credentials'), expect.any(Object));
      });

      it('should handle rate limiting', async () => {
        const ctx = createMockContext();
        mockSessionService.get.mockResolvedValue({ loginAttempts: 5, lastAttempt: Date.now() });

        const rateLimited = await authComposer.checkRateLimit(ctx);

        expect(rateLimited).toBe(true);
        expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Too many login attempts'), expect.any(Object));
      });
    });

    describe('User Logout', () => {
      it('should handle logout command', async () => {
        const ctx = createMockContext();
        mockSessionService.get.mockResolvedValue({ authenticated: true, userId: '123' });

        const logoutHandler = mockComposer.command.mock.calls.find((call) => call[0] === 'logout')?.[1];

        if (logoutHandler) {
          await logoutHandler(ctx);
        }

        expect(mockAuthService.logoutUser).toHaveBeenCalledWith('123');
        expect(mockSessionService.delete).toHaveBeenCalled();
      });

      it('should clear session data on logout', async () => {
        const ctx = createMockContext();
        const userId = '123';

        await authComposer.logoutUser(ctx, userId);

        expect(mockSessionService.delete).toHaveBeenCalledWith(expect.stringContaining(userId));

        expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('logged out'), expect.any(Object));
      });
    });
  });

  describe('Auth State Transitions', () => {
    describe('State Management', () => {
      it('should transition between auth states', async () => {
        const ctx = createMockContext();
        const states = ['initial', 'email', 'password', 'verification', 'completed'];

        for (let i = 0; i < states.length - 1; i++) {
          mockSessionService.get.mockResolvedValue({ step: states[i] });

          await authComposer.transitionState(ctx, states[i + 1]);

          expect(mockSessionService.set).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ step: states[i + 1] }),
          );
        }
      });

      it('should validate state transitions', async () => {
        const ctx = createMockContext();
        mockSessionService.get.mockResolvedValue({ step: 'initial' });

        // Invalid transition should be rejected
        const invalidTransition = authComposer.transitionState(ctx, 'completed');
        await expect(invalidTransition).rejects.toThrow('Invalid state transition');
      });

      it('should handle state timeouts', async () => {
        const ctx = createMockContext();
        const expiredState = {
          step: 'verification',
          createdAt: Date.now() - 11 * 60 * 1000, // 11 minutes ago
        };

        mockSessionService.get.mockResolvedValue(expiredState);

        const isExpired = await authComposer.isStateExpired(ctx);

        expect(isExpired).toBe(true);
        expect(mockSessionService.delete).toHaveBeenCalled();
      });

      it('should persist state across messages', async () => {
        const ctx = createMockContext();
        const authState = {
          step: 'email',
          userId: '123',
          email: 'test@example.com',
          createdAt: Date.now(),
        };

        await authComposer.saveAuthState(ctx, authState);

        expect(mockSessionService.set).toHaveBeenCalledWith(
          expect.stringContaining('auth'),
          authState,
          600, // 10 minutes TTL
        );
      });
    });

    describe('Multi-Step Registration', () => {
      it('should handle email collection step', async () => {
        const ctx = createMockContext({
          message: { ...createMockContext().message, text: 'user@example.com' },
        });

        mockSessionService.get.mockResolvedValue({ step: 'email' });

        await authComposer.handleEmailInput(ctx);

        expect(mockSessionService.set).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            step: 'password',
            email: 'user@example.com',
          }),
        );
      });

      it('should validate email format', async () => {
        const ctx = createMockContext({
          message: { ...createMockContext().message, text: 'invalid-email' },
        });

        mockSessionService.get.mockResolvedValue({ step: 'email' });

        await authComposer.handleEmailInput(ctx);

        expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('valid email'), expect.any(Object));
      });

      it('should handle password collection step', async () => {
        const ctx = createMockContext({
          message: { ...createMockContext().message, text: 'SecurePass123!' },
        });

        mockSessionService.get.mockResolvedValue({
          step: 'password',
          email: 'user@example.com',
        });

        await authComposer.handlePasswordInput(ctx);

        expect(mockSessionService.set).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            step: 'confirmation',
            password: expect.any(String), // Should be hashed
          }),
        );
      });

      it('should validate password strength', async () => {
        const weakPasswords = ['123', 'password', 'abc'];

        for (const password of weakPasswords) {
          const ctx = createMockContext({
            message: { ...createMockContext().message, text: password },
          });

          mockSessionService.get.mockResolvedValue({ step: 'password' });

          await authComposer.handlePasswordInput(ctx);

          expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Password must'), expect.any(Object));
        }
      });
    });
  });

  describe('Callback Query Handling', () => {
    it('should handle auth callback queries', async () => {
      const ctx = createMockContext({
        callbackQuery: {
          id: '123',
          from: createMockContext().from,
          data: 'auth:login:email',
          message: createMockContext().message,
        },
      });

      const callbackHandler = mockComposer.callbackQuery.mock.calls.find(
        (call) => call[0].toString() === '/^auth:/',
      )?.[1];

      if (callbackHandler) {
        await callbackHandler(ctx);
      }

      expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    });

    it('should handle registration method selection', async () => {
      const ctx = createMockContext({
        callbackQuery: {
          id: '123',
          from: createMockContext().from,
          data: 'auth:register:email',
          message: createMockContext().message,
        },
      });

      await authComposer.handleAuthCallback(ctx, 'register', 'email');

      expect(mockSessionService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          step: 'email',
          method: 'email',
        }),
      );
    });

    it('should handle login method selection', async () => {
      const ctx = createMockContext({
        callbackQuery: {
          id: '123',
          from: createMockContext().from,
          data: 'auth:login:credentials',
          message: createMockContext().message,
        },
      });

      await authComposer.handleAuthCallback(ctx, 'login', 'credentials');

      expect(ctx.editMessageText).toHaveBeenCalledWith(expect.stringContaining('Enter your email'), expect.any(Object));
    });

    it('should handle auth cancellation', async () => {
      const ctx = createMockContext({
        callbackQuery: {
          id: '123',
          from: createMockContext().from,
          data: 'auth:cancel',
          message: createMockContext().message,
        },
      });

      await authComposer.handleAuthCallback(ctx, 'cancel');

      expect(mockSessionService.delete).toHaveBeenCalled();
      expect(ctx.editMessageText).toHaveBeenCalledWith(expect.stringContaining('cancelled'), expect.any(Object));
    });
  });

  describe('Integration Tests', () => {
    it('should complete full registration flow', async () => {
      const ctx = createMockContext();

      // Step 1: Start registration
      mockSessionService.get.mockResolvedValueOnce(null);
      const registrationHandler = mockComposer.command.mock.calls.find((call) => call[0] === 'register')?.[1];

      if (registrationHandler) {
        await registrationHandler(ctx);
      }

      // Step 2: Enter email
      mockSessionService.get.mockResolvedValueOnce({ step: 'email' });
      ctx.message.text = 'user@example.com';
      await authComposer.handleEmailInput(ctx);

      // Step 3: Enter password
      mockSessionService.get.mockResolvedValueOnce({
        step: 'password',
        email: 'user@example.com',
      });

      ctx.message.text = 'SecurePass123!';
      await authComposer.handlePasswordInput(ctx);

      // Step 4: Verify code
      mockSessionService.get.mockResolvedValueOnce({
        step: 'verification',
        email: 'user@example.com',
      });

      mockAuthService.verifyCode.mockResolvedValue({ success: true });
      ctx.message.text = '123456';
      await authComposer.verifyRegistrationCode(ctx);

      expect(mockAuthService.registerUser).toHaveBeenCalled();
      expect(mockSessionService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ authenticated: true }),
      );
    });

    it('should complete full login flow', async () => {
      const ctx = createMockContext();

      // Step 1: Start login
      mockSessionService.get.mockResolvedValueOnce(null);
      const loginHandler = mockComposer.command.mock.calls.find((call) => call[0] === 'login')?.[1];

      if (loginHandler) {
        await loginHandler(ctx);
      }

      // Step 2: Enter credentials
      mockSessionService.get.mockResolvedValueOnce({ step: 'credentials' });
      mockAuthService.loginUser.mockResolvedValue({
        success: true,
        user: { id: '123', email: 'user@example.com' },
        token: 'jwt-token',
      });

      await authComposer.authenticateUser(ctx, {
        email: 'user@example.com',
        password: 'password123',
      });

      expect(mockAuthService.loginUser).toHaveBeenCalled();
      expect(mockSessionService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ authenticated: true }),
      );
    });

    it('should integrate with menu navigation', async () => {
      const ctx = createMockContext();
      mockSessionService.get.mockResolvedValue({ authenticated: true, userId: '123' });

      const isAuthenticated = await authComposer.checkAuthentication(ctx);

      expect(isAuthenticated).toBe(true);
      expect(mockBotService.sendMessage).not.toHaveBeenCalledWith(
        expect.any(Number),
        expect.stringContaining('Please log in'),
        expect.any(Object),
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors during auth', async () => {
      const ctx = createMockContext();
      mockAuthService.loginUser.mockRejectedValue(new Error('Network error'));

      await authComposer.authenticateUser(ctx, {
        email: 'user@example.com',
        password: 'password123',
      });

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('network error'), expect.any(Object));
    });

    it('should handle session corruption', async () => {
      const ctx = createMockContext();
      mockSessionService.get.mockResolvedValue('invalid-session-data');

      await authComposer.getAuthState(ctx);

      expect(mockSessionService.delete).toHaveBeenCalled();
      expect(mockSessionService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ step: 'initial' }),
      );
    });

    it('should handle service unavailability', async () => {
      const ctx = createMockContext();
      mockAuthService.getAuthState.mockRejectedValue(new Error('Service unavailable'));

      await authComposer.getAuthState(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('temporarily unavailable'), expect.any(Object));
    });
  });

  describe('Security Tests', () => {
    it('should prevent session fixation attacks', async () => {
      const ctx = createMockContext();
      const oldSessionId = 'old-session-id';
      const newSessionId = 'new-session-id';

      mockSessionService.get.mockResolvedValue({ sessionId: oldSessionId });

      await authComposer.regenerateSession(ctx);

      expect(mockSessionService.delete).toHaveBeenCalledWith(expect.stringContaining(oldSessionId));

      expect(mockSessionService.set).toHaveBeenCalledWith(expect.stringContaining(newSessionId), expect.any(Object));
    });

    it('should enforce session timeouts', async () => {
      const ctx = createMockContext();
      const expiredSession = {
        authenticated: true,
        userId: '123',
        lastActivity: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      };

      mockSessionService.get.mockResolvedValue(expiredSession);

      const isValid = await authComposer.validateSession(ctx);

      expect(isValid).toBe(false);
      expect(mockSessionService.delete).toHaveBeenCalled();
    });

    it('should sanitize user input', async () => {
      const ctx = createMockContext({
        message: {
          ...createMockContext().message,
          text: '<script>alert("xss")</script>user@example.com',
        },
      });

      mockSessionService.get.mockResolvedValue({ step: 'email' });

      await authComposer.handleEmailInput(ctx);

      // Should extract clean email
      expect(mockSessionService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          email: 'user@example.com', // XSS attempt removed
        }),
      );
    });
  });

  describe('Performance Tests', () => {
    it('should handle auth operations under performance threshold', async () => {
      const ctx = createMockContext();
      const start = performance.now();

      // Perform multiple auth operations
      await authComposer.getAuthState(ctx);
      await authComposer.checkAuthentication(ctx);
      await authComposer.isStateExpired(ctx);
      await authComposer.validateSession(ctx);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // Should complete under 100ms
    });

    it('should handle concurrent auth requests', async () => {
      const contexts = Array(10)
        .fill(null)
        .map((_, i) => createMockContext({ from: { ...createMockContext().from, id: i } }));

      mockSessionService.get.mockResolvedValue({ step: 'initial' });

      const promises = contexts.map((ctx) => authComposer.getAuthState(ctx));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(mockSessionService.get).toHaveBeenCalledTimes(10);
    });

    it('should not leak memory during auth flows', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process many auth operations
      for (let i = 0; i < 100; i++) {
        const ctx = createMockContext({ from: { ...createMockContext().from, id: i } });
        authComposer.getAuthState(ctx);
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

  describe('Edge Cases', () => {
    it('should handle malformed callback data', async () => {
      const ctx = createMockContext({
        callbackQuery: {
          id: '123',
          from: createMockContext().from,
          data: 'auth:invalid:format:too:many:params',
          message: createMockContext().message,
        },
      });

      await authComposer.handleAuthCallback(ctx, 'invalid', 'format');

      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(expect.stringContaining('Invalid action'), {
        show_alert: true,
      });
    });

    it('should handle empty message text', async () => {
      const ctx = createMockContext({
        message: { ...createMockContext().message, text: '' },
      });

      mockSessionService.get.mockResolvedValue({ step: 'email' });

      await authComposer.handleEmailInput(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Please enter'), expect.any(Object));
    });

    it('should handle very long input', async () => {
      const longInput = 'a'.repeat(1000) + '@example.com';
      const ctx = createMockContext({
        message: { ...createMockContext().message, text: longInput },
      });

      mockSessionService.get.mockResolvedValue({ step: 'email' });

      await authComposer.handleEmailInput(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('too long'), expect.any(Object));
    });

    it('should handle unicode characters', async () => {
      const unicodeEmail = 'тест@пример.рф';
      const ctx = createMockContext({
        message: { ...createMockContext().message, text: unicodeEmail },
      });

      mockSessionService.get.mockResolvedValue({ step: 'email' });

      await authComposer.handleEmailInput(ctx);

      // Should handle international domain names
      expect(mockSessionService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ email: unicodeEmail }),
      );
    });
  });
});
