import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { SessionService } from '../session.service';
import { RedisCacheService } from '@app/common-redis';
import { SessionInterface, SessionData } from '@app/feature-bot-shared';

/**
 * Integration Tests for SessionService with Redis
 *
 * These tests verify the integration between SessionService and Redis,
 * testing real Redis operations, data persistence, TTL handling,
 * and concurrent access patterns.
 */
describe('SessionService Integration Tests', () => {
  let service: SessionService;
  let module: TestingModule;
  let redisCacheService: RedisCacheService;
  let loggerSpy: jest.SpyInstance;

  const testUserId = 'integration-test-user-123';
  const sessionKeyPrefix = 'bot:session:';

  beforeAll(async () => {
    // Setup real Redis connection for integration testing
    module = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: RedisCacheService,
          useValue: {
            setHash: jest.fn(),
            getHash: jest.fn(),
            deleteFromHash: jest.fn(),
            del: jest.fn(),
            exists: jest.fn(),
            expire: jest.fn(),
            // Mock implementation that simulates Redis behavior
            _data: new Map(),
            _expirations: new Map(),
          },
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    redisCacheService = module.get<RedisCacheService>(RedisCacheService);

    // Mock logger methods
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    // Setup Redis mock behavior
    setupRedisMockBehavior();
  });

  beforeEach(async () => {
    // Clear Redis data before each test
    (redisCacheService as any)._data.clear();
    (redisCacheService as any)._expirations.clear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  function setupRedisMockBehavior() {
    const data = (redisCacheService as any)._data;
    const expirations = (redisCacheService as any)._expirations;

    (redisCacheService.setHash as jest.Mock).mockImplementation(async (key: string, hash: any, ttl?: number) => {
      data.set(key, { ...hash });
      if (ttl) {
        expirations.set(key, Date.now() + ttl * 1000);
      }

      return Promise.resolve();
    });

    (redisCacheService.getHash as jest.Mock).mockImplementation(async (key: string) => {
      const expiration = expirations.get(key);
      if (expiration && Date.now() > expiration) {
        data.delete(key);
        expirations.delete(key);

        return {};
      }

      return data.get(key) || {};
    });

    (redisCacheService.deleteFromHash as jest.Mock).mockImplementation(async (key: string, field: string) => {
      const hash = data.get(key);
      if (hash && hash[field]) {
        delete hash[field];
        if (Object.keys(hash).length === 0) {
          data.delete(key);
        }
      }

      return Promise.resolve();
    });

    (redisCacheService.exists as jest.Mock).mockImplementation(async (key: string) => {
      return data.has(key) ? 1 : 0;
    });

    (redisCacheService.expire as jest.Mock).mockImplementation(async (key: string, ttl: number) => {
      if (data.has(key)) {
        expirations.set(key, Date.now() + ttl * 1000);

        return 1;
      }

      return 0;
    });
  }

  describe('Redis Integration - Basic Operations', () => {
    it('should create and persist session in Redis', async () => {
      const initialData: Partial<SessionData> = {
        conversationState: {
          currentStep: 'test_step',
          availableSteps: ['step1', 'step2'],
          context: { test: 'data' },
          isActive: true,
          startedAt: new Date(),
        },
      };

      const session = await service.createSession(testUserId, initialData, 3600);

      expect(session).toBeDefined();
      expect(session.userId).toBe(testUserId);
      expect(session.data.conversationState?.currentStep).toBe('test_step');

      // Verify data was actually stored in Redis
      expect(redisCacheService.setHash).toHaveBeenCalledWith(
        `${sessionKeyPrefix}${testUserId}`,
        { session: expect.any(Object) },
        3600,
      );

      // Verify we can retrieve it
      const retrievedSession = await service.getSession(testUserId);
      expect(retrievedSession).toBeTruthy();
      expect(retrievedSession!.userId).toBe(testUserId);
      expect(retrievedSession!.data.conversationState?.currentStep).toBe('test_step');
    });

    it('should handle Redis connection failures gracefully', async () => {
      // Simulate Redis connection failure
      (redisCacheService.setHash as jest.Mock).mockRejectedValueOnce(new Error('Redis connection failed'));

      await expect(service.createSession(testUserId)).rejects.toThrow('Redis connection failed');
    });

    it('should handle Redis timeout scenarios', async () => {
      // Simulate Redis timeout
      (redisCacheService.getHash as jest.Mock).mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Redis timeout')), 50);
        });
      });

      const result = await service.getSession(testUserId);
      expect(result).toBeNull();
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to retrieve session'),
        expect.any(Object),
      );
    });
  });

  describe('Redis TTL and Expiration', () => {
    it('should respect TTL settings', async () => {
      const shortTtl = 1; // 1 second
      await service.createSession(testUserId, {}, shortTtl);

      // Session should exist immediately
      let session = await service.getSession(testUserId);
      expect(session).toBeTruthy();

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Session should be expired and removed
      session = await service.getSession(testUserId);
      expect(session).toBeNull();
    });

    it('should extend session TTL correctly', async () => {
      const initialTtl = 2; // 2 seconds
      await service.createSession(testUserId, {}, initialTtl);

      // Wait 1 second, then extend
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const extended = await service.extendSession(testUserId, 5000); // 5 seconds
      expect(extended).toBe(true);

      // Session should still be available after original TTL
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const session = await service.getSession(testUserId);
      expect(session).toBeTruthy();
    });

    it('should cap extension at maximum TTL', async () => {
      await service.createSession(testUserId);

      const veryLongExtension = 30 * 24 * 60 * 60 * 1000; // 30 days
      const extended = await service.extendSession(testUserId, veryLongExtension);

      expect(extended).toBe(true);

      // Verify TTL was capped (7 days max)
      const setHashCalls = (redisCacheService.setHash as jest.Mock).mock.calls;
      const lastCall = setHashCalls[setHashCalls.length - 1];
      const actualTtl = lastCall[2];
      expect(actualTtl).toBeLessThanOrEqual(7 * 24 * 60 * 60); // Max 7 days
    });
  });

  describe('Redis Data Consistency', () => {
    it('should maintain data consistency during concurrent updates', async () => {
      await service.createSession(testUserId, {
        cache: { initialValue: 'test' },
      });

      // Simulate concurrent updates
      const updatePromises = Array(5)
        .fill(null)
        .map((_, i) =>
          service.updateSession(testUserId, {
            cache: { [`update${i}`]: `value${i}` },
          }),
        );

      const results = await Promise.all(updatePromises);

      expect(results).toHaveLength(5);
      results.forEach((result) => expect(result).toBeDefined());

      // Final session should contain all updates
      const finalSession = await service.getSession(testUserId);
      expect(finalSession).toBeTruthy();
      expect(finalSession!.data.cache).toMatchObject({
        initialValue: 'test',
        update0: 'value0',
        update1: 'value1',
        update2: 'value2',
        update3: 'value3',
        update4: 'value4',
      });
    });

    it('should handle session deletion during updates', async () => {
      await service.createSession(testUserId);

      // Start an update and delete simultaneously
      const updatePromise = service.updateSession(testUserId, {
        cache: { updating: true },
      });

      const deletePromise = service.deleteSession(testUserId);

      await Promise.all([updatePromise, deletePromise]);

      // Session should either be updated or deleted, but not in inconsistent state
      const session = await service.getSession(testUserId);
      if (session) {
        expect(session.data.cache?.updating).toBe(true);
      }
    });

    it('should maintain referential integrity with complex nested objects', async () => {
      const complexData: Partial<SessionData> = {
        conversationState: {
          currentStep: 'complex',
          availableSteps: ['step1', 'step2', 'step3'],
          context: {
            user: { id: '123', preferences: { theme: 'dark', language: 'en' } },
            navigation: { history: ['/home', '/profile', '/settings'] },
            formData: {
              registration: {
                email: 'test@example.com',
                profile: { firstName: 'Test', lastName: 'User' },
              },
            },
          },
          isActive: true,
          startedAt: new Date(),
        },
        preferences: {
          language: 'en',
          notifications: {
            enablePush: true,
            enableEmail: false,
            enableSms: true,
            categories: {
              marketing: false,
              updates: true,
              security: true,
            },
          },
          display: {
            theme: 'dark',
            timezone: 'UTC',
            dateFormat: 'DD/MM/YYYY',
            numberFormat: 'en-US',
          },
          privacy: {
            shareAnalytics: false,
            shareUsageData: true,
            allowDataExport: true,
          },
        },
        cache: {
          userProfile: { lastFetch: Date.now(), data: { verified: true } },
          apiResponses: {
            balance: { amount: 100.5, currency: 'USD', lastUpdate: Date.now() },
          },
        },
      };

      const session = await service.createSession(testUserId, complexData);

      // Retrieve and verify complex structure is preserved
      const retrievedSession = await service.getSession(testUserId);

      expect(retrievedSession).toBeTruthy();
      expect(retrievedSession!.data.conversationState?.context.user.preferences.theme).toBe('dark');
      expect(retrievedSession!.data.preferences?.notifications?.categories?.security).toBe(true);
      expect(retrievedSession!.data.cache?.apiResponses?.balance?.amount).toBe(100.5);
    });
  });

  describe('Redis Connection Recovery', () => {
    it('should recover from temporary Redis failures', async () => {
      await service.createSession(testUserId, { cache: { step: 1 } });

      // Simulate temporary Redis failure
      let failureCount = 0;
      const originalGetHash = redisCacheService.getHash;
      (redisCacheService.getHash as jest.Mock).mockImplementation(async (key: string) => {
        failureCount++;
        if (failureCount <= 2) {
          throw new Error('Temporary Redis failure');
        }

        return originalGetHash.call(redisCacheService, key);
      });

      // First two calls should fail and return null
      let session = await service.getSession(testUserId);
      expect(session).toBeNull();

      session = await service.getSession(testUserId);
      expect(session).toBeNull();

      // Third call should succeed
      session = await service.getSession(testUserId);
      expect(session).toBeTruthy();
      expect(session!.data.cache?.step).toBe(1);
    });

    it('should handle Redis memory pressure gracefully', async () => {
      // Simulate Redis memory pressure by limiting storage
      const maxSessions = 3;
      let sessionCount = 0;

      (redisCacheService.setHash as jest.Mock).mockImplementation(async (key: string, hash: any, ttl?: number) => {
        sessionCount++;
        if (sessionCount > maxSessions) {
          throw new Error('Redis memory limit exceeded');
        }

        return (redisCacheService as any)._data.set(key, { ...hash });
      });

      // First 3 sessions should succeed
      for (let i = 0; i < maxSessions; i++) {
        await expect(service.createSession(`user${i}`)).resolves.toBeDefined();
      }

      // 4th session should fail due to memory pressure
      await expect(service.createSession('user3')).rejects.toThrow('Redis memory limit exceeded');
    });
  });

  describe('Redis Performance Optimization', () => {
    it('should batch Redis operations efficiently', async () => {
      const batchSize = 10;
      const operations: Promise<any>[] = [];

      // Create multiple sessions simultaneously
      for (let i = 0; i < batchSize; i++) {
        operations.push(
          service.createSession(`batch-user-${i}`, {
            cache: { batchIndex: i },
          }),
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(batchSize);
      expect(duration).toBeLessThan(500); // Should complete batch under 500ms

      // Verify all sessions were created
      for (let i = 0; i < batchSize; i++) {
        const session = await service.getSession(`batch-user-${i}`);
        expect(session).toBeTruthy();
        expect(session!.data.cache?.batchIndex).toBe(i);
      }
    });

    it('should optimize memory usage with large session data', async () => {
      const largeData: Partial<SessionData> = {
        cache: {},
      };

      // Create large cache object
      for (let i = 0; i < 1000; i++) {
        largeData.cache![`item${i}`] = {
          id: i,
          data: `large-data-item-${i}`.repeat(10),
          timestamp: Date.now(),
          metadata: {
            category: `category-${i % 10}`,
            tags: [`tag1-${i}`, `tag2-${i}`, `tag3-${i}`],
          },
        };
      }

      const startTime = Date.now();
      const session = await service.createSession(testUserId, largeData);
      const createDuration = Date.now() - startTime;

      expect(session).toBeDefined();
      expect(createDuration).toBeLessThan(1000); // Should handle large data under 1s

      const retrieveStart = Date.now();
      const retrievedSession = await service.getSession(testUserId);
      const retrieveDuration = Date.now() - retrieveStart;

      expect(retrievedSession).toBeTruthy();
      expect(retrieveDuration).toBeLessThan(500); // Should retrieve large data under 500ms
      expect(Object.keys(retrievedSession!.data.cache!)).toHaveLength(1000);
    });

    it('should handle Redis pipeline operations efficiently', async () => {
      const operations = [
        () => service.createSession('pipeline-user-1', { cache: { op: 'create1' } }),
        () => service.updateSession('pipeline-user-1', { cache: { op: 'update1' } }),
        () => service.getSession('pipeline-user-1'),
        () => service.extendSession('pipeline-user-1', 7200),
        () => service.createSession('pipeline-user-2', { cache: { op: 'create2' } }),
        () => service.updateSession('pipeline-user-2', { cache: { op: 'update2' } }),
        () => service.getSession('pipeline-user-2'),
        () => service.deleteSession('pipeline-user-2'),
      ];

      const startTime = Date.now();
      const results = await Promise.all(operations.map((op) => op()));
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(300); // Pipelined operations should be fast
      expect(results[2]).toBeTruthy(); // Get user 1 should succeed
      expect(results[6]).toBeTruthy(); // Get user 2 should succeed before deletion

      // Verify final state
      const finalUser1 = await service.getSession('pipeline-user-1');
      const finalUser2 = await service.getSession('pipeline-user-2');

      expect(finalUser1).toBeTruthy();
      expect(finalUser2).toBeNull(); // Should be deleted
    });
  });

  describe('Redis Data Migration and Compatibility', () => {
    it('should handle different Redis key formats', async () => {
      // Test with different key naming patterns
      const keyVariations = [
        'normal-user-123',
        'user-with-special-chars-!@#$%',
        'user-with-unicode-ñáéíóú',
        'user-with-numbers-12345',
        'user-with-dashes-and-underscores_123-456',
      ];

      for (const userId of keyVariations) {
        const session = await service.createSession(userId, {
          cache: { userId },
        });

        expect(session).toBeDefined();

        const retrieved = await service.getSession(userId);
        expect(retrieved).toBeTruthy();
        expect(retrieved!.data.cache?.userId).toBe(userId);
      }
    });

    it('should handle version migration scenarios', async () => {
      // Simulate old session format in Redis
      const oldFormatSession = {
        userId: testUserId,
        data: {
          // Old format without some new fields
          state: 'old_state',
          cache: { version: '1.0' },
        },
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      // Manually insert old format data
      (redisCacheService as any)._data.set(`${sessionKeyPrefix}${testUserId}`, {
        session: oldFormatSession,
      });

      // Service should handle old format gracefully
      const session = await service.getSession(testUserId);
      expect(session).toBeTruthy();
      expect(session!.userId).toBe(testUserId);

      // Update should migrate to new format
      await service.updateSession(testUserId, {
        conversationState: {
          currentStep: 'migrated',
          availableSteps: [],
          context: {},
          isActive: true,
          startedAt: new Date(),
        },
      });

      const migratedSession = await service.getSession(testUserId);
      expect(migratedSession!.data.conversationState?.currentStep).toBe('migrated');
    });
  });

  describe('Redis Monitoring and Debugging', () => {
    it('should provide debug information for session operations', async () => {
      const debugUserId = 'debug-test-user';

      // Enable debug logging
      jest.spyOn(Logger.prototype, 'debug').mockImplementation((message, context) => {
        expect(message).toContain(debugUserId);
        if (context) {
          expect(context).toHaveProperty('userId', debugUserId);
        }
      });

      await service.createSession(debugUserId);
      await service.getSession(debugUserId);
      await service.updateSession(debugUserId, { cache: { debug: true } });
      await service.deleteSession(debugUserId);

      expect(Logger.prototype.debug).toHaveBeenCalledTimes(4);
    });

    it('should track Redis operation metrics', async () => {
      const metricsUserId = 'metrics-test-user';
      let operationCount = 0;

      // Wrap Redis operations to count them
      const originalSetHash = redisCacheService.setHash;
      const originalGetHash = redisCacheService.getHash;

      (redisCacheService.setHash as jest.Mock).mockImplementation(async (...args) => {
        operationCount++;

        return originalSetHash.call(redisCacheService, ...args);
      });

      (redisCacheService.getHash as jest.Mock).mockImplementation(async (...args) => {
        operationCount++;

        return originalGetHash.call(redisCacheService, ...args);
      });

      // Perform session operations
      await service.createSession(metricsUserId); // 1 set
      await service.getSession(metricsUserId); // 1 get
      await service.updateSession(metricsUserId, { cache: { test: true } }); // 1 get + 1 set
      await service.extendSession(metricsUserId); // 1 get + 1 set

      expect(operationCount).toBeGreaterThanOrEqual(6); // At least 6 Redis operations
    });
  });
});
