import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { SessionService } from '../session.service';
import { RedisCacheService } from '@app/common-redis';
import { SessionInterface, SessionData } from '@app/feature-bot-shared';

describe('SessionService', () => {
  let service: SessionService;
  let module: TestingModule;
  let mockRedisCacheService: jest.Mocked<RedisCacheService>;
  let loggerSpy: jest.SpyInstance;

  const mockUserId = '123456789';
  const mockSessionKey = 'bot:session:123456789';

  const createMockSessionData = (): SessionData => ({
    conversationState: {
      currentStep: 'test_step',
      availableSteps: ['step1', 'step2'],
      context: { test: 'data' },
      isActive: true,
      startedAt: new Date(),
    },
    preferences: {
      language: 'en',
      notifications: {
        enablePush: true,
        enableEmail: false,
        enableSms: false,
        categories: {},
      },
      display: {
        theme: 'auto',
        timezone: 'UTC',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: 'en-US',
      },
      privacy: {
        shareAnalytics: true,
        shareUsageData: true,
        allowDataExport: true,
      },
    },
    navigationState: {
      currentLocation: 'main',
      breadcrumb: [],
      history: [],
      metadata: {},
    },
    formData: {},
    cache: {},
    custom: {},
  });

  const createMockSession = (): SessionInterface => ({
    userId: mockUserId,
    data: createMockSessionData(),
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T01:00:00Z'),
    expiresAt: new Date('2023-01-02T00:00:00Z'),
    metadata: {
      version: '1.0',
      platform: 'telegram-bot',
    },
  });

  beforeEach(async () => {
    mockRedisCacheService = {
      setHash: jest.fn(),
      getHash: jest.fn(),
      deleteFromHash: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
    } as any;

    module = await Test.createTestingModule({
      providers: [SessionService, { provide: RedisCacheService, useValue: mockRedisCacheService }],
    }).compile();

    service = module.get<SessionService>(SessionService);
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

  describe('Session Creation', () => {
    it('should create session successfully with default data', async () => {
      mockRedisCacheService.setHash.mockResolvedValueOnce(undefined);

      const session = await service.createSession(mockUserId);

      expect(session).toEqual(
        expect.objectContaining({
          userId: mockUserId,
          data: expect.objectContaining({
            conversationState: expect.objectContaining({
              currentStep: 'initial',
              isActive: false,
            }),
            preferences: expect.objectContaining({
              language: 'en',
            }),
          }),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          expiresAt: expect.any(Date),
        }),
      );

      expect(mockRedisCacheService.setHash).toHaveBeenCalledWith(
        mockSessionKey,
        { session: expect.any(Object) },
        24 * 60 * 60, // Default TTL
      );
    });

    it('should create session with initial data', async () => {
      const initialData: Partial<SessionData> = {
        conversationState: {
          currentStep: 'custom_step',
          availableSteps: ['custom'],
          context: { custom: true },
          isActive: true,
          startedAt: new Date(),
        },
      };

      mockRedisCacheService.setHash.mockResolvedValueOnce(undefined);

      const session = await service.createSession(mockUserId, initialData);

      expect(session.data.conversationState?.currentStep).toBe('custom_step');
      expect(session.data.conversationState?.context.custom).toBe(true);
    });

    it('should create session with custom TTL', async () => {
      const customTtl = 3600; // 1 hour
      mockRedisCacheService.setHash.mockResolvedValueOnce(undefined);

      const session = await service.createSession(mockUserId, undefined, customTtl);

      expect(mockRedisCacheService.setHash).toHaveBeenCalledWith(mockSessionKey, expect.any(Object), customTtl);

      const expectedExpiry = new Date(Date.now() + customTtl * 1000);
      expect(session.expiresAt.getTime()).toBeCloseTo(expectedExpiry.getTime(), -3);
    });

    it('should handle session creation errors', async () => {
      const createError = new Error('Redis connection failed');
      mockRedisCacheService.setHash.mockRejectedValueOnce(createError);

      await expect(service.createSession(mockUserId)).rejects.toThrow('Redis connection failed');
    });
  });

  describe('Session Retrieval', () => {
    it('should retrieve existing session successfully', async () => {
      const mockSession = createMockSession();
      mockRedisCacheService.getHash.mockResolvedValueOnce({ session: mockSession });

      const session = await service.getSession(mockUserId);

      expect(session).toEqual(
        expect.objectContaining({
          userId: mockUserId,
          data: expect.any(Object),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          expiresAt: expect.any(Date),
        }),
      );

      expect(mockRedisCacheService.getHash).toHaveBeenCalledWith(mockSessionKey);
    });

    it('should return null when session does not exist', async () => {
      mockRedisCacheService.getHash.mockResolvedValueOnce({});

      const session = await service.getSession(mockUserId);

      expect(session).toBeNull();
    });

    it('should handle expired sessions', async () => {
      const expiredSession = createMockSession();
      expiredSession.expiresAt = new Date('2020-01-01T00:00:00Z'); // Past date
      mockRedisCacheService.getHash.mockResolvedValueOnce({ session: expiredSession });
      mockRedisCacheService.deleteFromHash.mockResolvedValueOnce(undefined);

      const session = await service.getSession(mockUserId);

      expect(session).toBeNull();
      expect(mockRedisCacheService.deleteFromHash).toHaveBeenCalledWith(mockSessionKey, 'session');
    });

    it('should handle session retrieval errors', async () => {
      const retrieveError = new Error('Redis connection failed');
      mockRedisCacheService.getHash.mockRejectedValueOnce(retrieveError);

      const session = await service.getSession(mockUserId);

      expect(session).toBeNull();
      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('should parse date strings from Redis correctly', async () => {
      const mockSession = createMockSession();
      // Redis returns dates as strings
      const sessionWithStringDates = {
        ...mockSession,
        createdAt: mockSession.createdAt.toISOString(),
        updatedAt: mockSession.updatedAt.toISOString(),
        expiresAt: mockSession.expiresAt.toISOString(),
        data: {
          ...mockSession.data,
          conversationState: {
            ...mockSession.data.conversationState,
            startedAt: mockSession.data.conversationState!.startedAt.toISOString(),
          },
        },
      };

      mockRedisCacheService.getHash.mockResolvedValueOnce({ session: sessionWithStringDates });

      const session = await service.getSession(mockUserId);

      expect(session?.createdAt).toBeInstanceOf(Date);
      expect(session?.updatedAt).toBeInstanceOf(Date);
      expect(session?.expiresAt).toBeInstanceOf(Date);
      expect(session?.data.conversationState?.startedAt).toBeInstanceOf(Date);
    });
  });

  describe('Session Updates', () => {
    it('should update existing session successfully', async () => {
      const existingSession = createMockSession();
      mockRedisCacheService.getHash.mockResolvedValueOnce({ session: existingSession });
      mockRedisCacheService.setHash.mockResolvedValueOnce(undefined);

      const updateData: Partial<SessionData> = {
        conversationState: {
          currentStep: 'updated_step',
          availableSteps: ['updated'],
          context: { updated: true },
          isActive: true,
          startedAt: new Date(),
        },
      };

      const updatedSession = await service.updateSession(mockUserId, updateData);

      expect(updatedSession.data.conversationState?.currentStep).toBe('updated_step');
      expect(updatedSession.data.conversationState?.context.updated).toBe(true);
      expect(updatedSession.updatedAt).toBeInstanceOf(Date);

      expect(mockRedisCacheService.setHash).toHaveBeenCalledWith(
        mockSessionKey,
        { session: expect.any(Object) },
        24 * 60 * 60, // Default TTL
      );
    });

    it('should create new session if none exists', async () => {
      mockRedisCacheService.getHash.mockResolvedValueOnce({});
      mockRedisCacheService.setHash.mockResolvedValueOnce(undefined);

      const updateData: Partial<SessionData> = {
        conversationState: {
          currentStep: 'new_step',
          availableSteps: ['new'],
          context: { new: true },
          isActive: true,
          startedAt: new Date(),
        },
      };

      const session = await service.updateSession(mockUserId, updateData);

      expect(session.data.conversationState?.currentStep).toBe('new_step');
    });

    it('should deep merge nested objects', async () => {
      const existingSession = createMockSession();
      existingSession.data.preferences = {
        language: 'en',
        notifications: {
          enablePush: true,
          enableEmail: false,
          enableSms: false,
          categories: { marketing: true },
        },
        display: {
          theme: 'dark',
          timezone: 'UTC',
          dateFormat: 'DD/MM/YYYY',
          numberFormat: 'en-US',
        },
        privacy: {
          shareAnalytics: true,
          shareUsageData: true,
          allowDataExport: true,
        },
      };

      mockRedisCacheService.getHash.mockResolvedValueOnce({ session: existingSession });
      mockRedisCacheService.setHash.mockResolvedValueOnce(undefined);

      const updateData: Partial<SessionData> = {
        preferences: {
          language: 'es',
          notifications: {
            enableEmail: true,
            categories: { updates: true },
          },
        } as any,
      };

      const updatedSession = await service.updateSession(mockUserId, updateData);

      expect(updatedSession.data.preferences?.language).toBe('es');
      expect(updatedSession.data.preferences?.notifications?.enablePush).toBe(true); // Preserved
      expect(updatedSession.data.preferences?.notifications?.enableEmail).toBe(true); // Updated
      expect(updatedSession.data.preferences?.notifications?.categories).toEqual({
        marketing: true,
        updates: true,
      }); // Merged
    });

    it('should update session with custom TTL', async () => {
      const existingSession = createMockSession();
      mockRedisCacheService.getHash.mockResolvedValueOnce({ session: existingSession });
      mockRedisCacheService.setHash.mockResolvedValueOnce(undefined);

      const customTtl = 1800; // 30 minutes
      await service.updateSession(mockUserId, {}, customTtl);

      expect(mockRedisCacheService.setHash).toHaveBeenCalledWith(mockSessionKey, expect.any(Object), customTtl);
    });

    it('should handle update errors', async () => {
      const existingSession = createMockSession();
      mockRedisCacheService.getHash.mockResolvedValueOnce({ session: existingSession });
      mockRedisCacheService.setHash.mockRejectedValueOnce(new Error('Update failed'));

      await expect(service.updateSession(mockUserId, {})).rejects.toThrow('Update failed');
    });
  });

  describe('Session Deletion', () => {
    it('should delete session successfully', async () => {
      mockRedisCacheService.deleteFromHash.mockResolvedValueOnce(undefined);

      await service.deleteSession(mockUserId);

      expect(mockRedisCacheService.deleteFromHash).toHaveBeenCalledWith(mockSessionKey, 'session');
    });

    it('should handle deletion errors', async () => {
      const deleteError = new Error('Delete failed');
      mockRedisCacheService.deleteFromHash.mockRejectedValueOnce(deleteError);

      await expect(service.deleteSession(mockUserId)).rejects.toThrow('Delete failed');
    });
  });

  describe('Session Validation', () => {
    it('should validate valid session', () => {
      const validSession = createMockSession();
      validSession.expiresAt = new Date(Date.now() + 60000); // 1 minute in future

      const isValid = service.isSessionValid(validSession);

      expect(isValid).toBe(true);
    });

    it('should invalidate expired session', () => {
      const expiredSession = createMockSession();
      expiredSession.expiresAt = new Date(Date.now() - 60000); // 1 minute in past

      const isValid = service.isSessionValid(expiredSession);

      expect(isValid).toBe(false);
    });

    it('should invalidate session with missing structure', () => {
      const invalidSession = {
        userId: '',
        data: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
        metadata: {},
      } as any;

      const isValid = service.isSessionValid(invalidSession);

      expect(isValid).toBe(false);
    });
  });

  describe('Session Extension', () => {
    it('should extend session successfully', async () => {
      const existingSession = createMockSession();
      mockRedisCacheService.getHash.mockResolvedValueOnce({ session: existingSession });
      mockRedisCacheService.setHash.mockResolvedValueOnce(undefined);

      const extensionMs = 3600000; // 1 hour
      const success = await service.extendSession(mockUserId, extensionMs);

      expect(success).toBe(true);
      expect(mockRedisCacheService.setHash).toHaveBeenCalledWith(
        mockSessionKey,
        expect.objectContaining({
          session: expect.objectContaining({
            expiresAt: expect.any(Date),
          }),
        }),
        expect.any(Number),
      );
    });

    it('should not extend non-existent session', async () => {
      mockRedisCacheService.getHash.mockResolvedValueOnce({});

      const success = await service.extendSession(mockUserId);

      expect(success).toBe(false);
    });

    it('should cap extension at maximum TTL', async () => {
      const existingSession = createMockSession();
      mockRedisCacheService.getHash.mockResolvedValueOnce({ session: existingSession });
      mockRedisCacheService.setHash.mockResolvedValueOnce(undefined);

      const extensionMs = 10 * 24 * 60 * 60 * 1000; // 10 days (exceeds max)
      const success = await service.extendSession(mockUserId, extensionMs);

      expect(success).toBe(true);

      const setHashCall = mockRedisCacheService.setHash.mock.calls[0];
      const ttlSeconds = setHashCall[2];
      expect(ttlSeconds).toBeLessThanOrEqual(7 * 24 * 60 * 60); // Max 7 days
    });

    it('should handle extension errors', async () => {
      const existingSession = createMockSession();
      mockRedisCacheService.getHash.mockResolvedValueOnce({ session: existingSession });
      mockRedisCacheService.setHash.mockRejectedValueOnce(new Error('Extension failed'));

      const success = await service.extendSession(mockUserId);

      expect(success).toBe(false);
    });
  });

  describe('Get or Create Session', () => {
    it('should return existing session and extend it', async () => {
      const existingSession = createMockSession();
      mockRedisCacheService.getHash.mockResolvedValueOnce({ session: existingSession });
      const extendSpy = jest.spyOn(service, 'extendSession').mockResolvedValue(true);

      const session = await service.getOrCreateSession(mockUserId);

      expect(session).toEqual(existingSession);
      expect(extendSpy).toHaveBeenCalledWith(mockUserId);
    });

    it('should create new session if none exists', async () => {
      mockRedisCacheService.getHash.mockResolvedValueOnce({});
      mockRedisCacheService.setHash.mockResolvedValueOnce(undefined);

      const initialData: Partial<SessionData> = {
        conversationState: {
          currentStep: 'new',
          availableSteps: [],
          context: {},
          isActive: true,
          startedAt: new Date(),
        },
      };

      const session = await service.getOrCreateSession(mockUserId, initialData);

      expect(session.data.conversationState?.currentStep).toBe('new');
    });
  });

  describe('Session Cleanup', () => {
    it('should clear expired sessions', async () => {
      const count = await service.clearExpiredSessions();

      expect(count).toBe(0); // Redis handles TTL automatically
    });

    it('should handle cleanup errors', async () => {
      // Force an error in cleanup method by mocking internal operations
      jest.spyOn(Logger.prototype, 'log').mockImplementationOnce(() => {
        throw new Error('Cleanup failed');
      });

      await expect(service.clearExpiredSessions()).rejects.toThrow('Cleanup failed');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent session operations', async () => {
      mockRedisCacheService.getHash.mockResolvedValue({ session: createMockSession() });
      mockRedisCacheService.setHash.mockResolvedValue(undefined);

      const operations = Array(10)
        .fill(null)
        .map((_, i) => {
          if (i % 3 === 0) {
            return service.createSession(`user${i}`);
          }

          if (i % 3 === 1) {
            return service.getSession(`user${i}`);
          }

          return service.updateSession(`user${i}`, { custom: { test: i } });
        });

      const results = await Promise.all(operations);

      expect(results).toHaveLength(10);
    });

    it('should process session operations under performance threshold', async () => {
      mockRedisCacheService.setHash.mockResolvedValue(undefined);

      const start = performance.now();
      await service.createSession(mockUserId);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100); // Should complete under 100ms
    });

    it('should handle large session data efficiently', async () => {
      const largeInitialData: Partial<SessionData> = {
        cache: Object.fromEntries(
          Array(1000)
            .fill(null)
            .map((_, i) => [`key${i}`, `value${i}`]),
        ),
      };

      mockRedisCacheService.setHash.mockResolvedValue(undefined);

      const start = performance.now();
      const session = await service.createSession(mockUserId, largeInitialData);
      const duration = performance.now() - start;

      expect(session).toBeDefined();
      expect(duration).toBeLessThan(500); // Should handle large data under 500ms
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory during session lifecycle', async () => {
      mockRedisCacheService.getHash.mockResolvedValue({ session: createMockSession() });
      mockRedisCacheService.setHash.mockResolvedValue(undefined);
      mockRedisCacheService.deleteFromHash.mockResolvedValue(undefined);

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple session operations
      for (let i = 0; i < 10; i++) {
        await service.createSession(`user${i}`);
        await service.getSession(`user${i}`);
        await service.updateSession(`user${i}`, { test: i });
        await service.deleteSession(`user${i}`);
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
    it('should handle empty user ID', async () => {
      await expect(service.createSession('')).rejects.toBeDefined();
    });

    it('should handle null session data', async () => {
      const session = await service.createSession(mockUserId, null as any);
      expect(session.data).toBeDefined();
    });

    it('should handle malformed Redis response', async () => {
      mockRedisCacheService.getHash.mockResolvedValueOnce({ session: 'invalid-data' });

      const session = await service.getSession(mockUserId);

      expect(session).toBeNull();
    });

    it('should handle concurrent updates to same session', async () => {
      const existingSession = createMockSession();
      mockRedisCacheService.getHash.mockResolvedValue({ session: existingSession });
      mockRedisCacheService.setHash.mockResolvedValue(undefined);

      const updates = Array(5)
        .fill(null)
        .map((_, i) => service.updateSession(mockUserId, { custom: { update: i } }));

      const results = await Promise.all(updates);

      expect(results).toHaveLength(5);
      results.forEach((result) => expect(result).toBeDefined());
    });
  });

  describe('Integration with Redis', () => {
    it('should use correct Redis key format', async () => {
      mockRedisCacheService.setHash.mockResolvedValueOnce(undefined);

      await service.createSession(mockUserId);

      expect(mockRedisCacheService.setHash).toHaveBeenCalledWith(
        'bot:session:123456789',
        expect.any(Object),
        expect.any(Number),
      );
    });

    it('should handle Redis connection failures gracefully', async () => {
      const connectionError = new Error('Redis connection failed');
      mockRedisCacheService.getHash.mockRejectedValue(connectionError);

      const session = await service.getSession(mockUserId);

      expect(session).toBeNull();
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to retrieve session'),
        expect.objectContaining({
          userId: mockUserId,
        }),
      );
    });
  });
});
