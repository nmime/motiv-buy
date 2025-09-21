import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { SessionService } from '../session.service';
import { RedisCacheService } from '@app/common-redis';
import { SessionInterface, SessionData } from '@app/feature-bot-shared';

/**
 * Session Persistence and Retrieval Tests
 *
 * Comprehensive testing of session data persistence, retrieval, and consistency
 * across different scenarios including cross-session persistence, data migration,
 * backup/restore operations, and complex data structure handling.
 */
describe('Session Persistence and Retrieval Tests', () => {
  let service: SessionService;
  let module: TestingModule;
  let mockRedisCacheService: jest.Mocked<RedisCacheService>;
  let loggerSpy: jest.SpyInstance;

  const mockUserId = 'persistence-test-user-123';
  const sessionKeyPrefix = 'bot:session:';

  beforeEach(async () => {
    // Setup Redis mock with in-memory storage simulation
    const inMemoryStore = new Map<string, any>();
    const expirationStore = new Map<string, number>();

    mockRedisCacheService = {
      setHash: jest.fn(),
      getHash: jest.fn(),
      deleteFromHash: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      // Additional methods for testing
      keys: jest.fn(),
      ttl: jest.fn(),
      persist: jest.fn(),
    } as any;

    // Setup realistic Redis behavior simulation
    mockRedisCacheService.setHash.mockImplementation(async (key: string, hash: any, ttl?: number) => {
      inMemoryStore.set(key, JSON.parse(JSON.stringify(hash))); // Deep clone to simulate serialization
      if (ttl) {
        expirationStore.set(key, Date.now() + ttl * 1000);
      }
    });

    mockRedisCacheService.getHash.mockImplementation(async (key: string) => {
      // Check expiration
      const expiry = expirationStore.get(key);
      if (expiry && Date.now() > expiry) {
        inMemoryStore.delete(key);
        expirationStore.delete(key);

        return {};
      }

      return inMemoryStore.get(key) || {};
    });

    mockRedisCacheService.deleteFromHash.mockImplementation(async (key: string, field: string) => {
      const hash = inMemoryStore.get(key);
      if (hash && hash[field]) {
        delete hash[field];
        if (Object.keys(hash).length === 0) {
          inMemoryStore.delete(key);
          expirationStore.delete(key);
        }
      }
    });

    mockRedisCacheService.exists.mockImplementation(async (key: string) => {
      return inMemoryStore.has(key) ? 1 : 0;
    });

    mockRedisCacheService.ttl.mockImplementation(async (key: string) => {
      const expiry = expirationStore.get(key);
      if (!expiry) {
        return -1;
      } // No expiry set

      const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));

      return remaining;
    });

    mockRedisCacheService.keys.mockImplementation(async (pattern: string) => {
      const regex = new RegExp(pattern.replace('*', '.*'));

      return Array.from(inMemoryStore.keys()).filter((key) => regex.test(key));
    });

    module = await Test.createTestingModule({
      providers: [SessionService, { provide: RedisCacheService, useValue: mockRedisCacheService }],
    }).compile();

    service = module.get<SessionService>(SessionService);

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

  describe('Basic Persistence Operations', () => {
    it('should persist and retrieve simple session data', async () => {
      const initialData: Partial<SessionData> = {
        conversationState: {
          currentStep: 'test_step',
          availableSteps: ['step1', 'step2'],
          context: { testKey: 'testValue' },
          isActive: true,
          startedAt: new Date(),
        },
      };

      // Create session
      const createdSession = await service.createSession(mockUserId, initialData);

      expect(createdSession).toBeDefined();
      expect(createdSession.userId).toBe(mockUserId);

      // Retrieve session
      const retrievedSession = await service.getSession(mockUserId);

      expect(retrievedSession).toBeTruthy();
      expect(retrievedSession!.userId).toBe(mockUserId);
      expect(retrievedSession!.data.conversationState?.currentStep).toBe('test_step');
      expect(retrievedSession!.data.conversationState?.context.testKey).toBe('testValue');
    });

    it('should handle session updates and maintain consistency', async () => {
      // Create initial session
      await service.createSession(mockUserId, {
        cache: { initialValue: 'original' },
      });

      // Update session multiple times
      await service.updateSession(mockUserId, {
        cache: { updatedValue: 'first_update' },
      });

      await service.updateSession(mockUserId, {
        cache: { finalValue: 'final_update' },
      });

      // Retrieve and verify final state
      const finalSession = await service.getSession(mockUserId);

      expect(finalSession).toBeTruthy();
      expect(finalSession!.data.cache).toMatchObject({
        initialValue: 'original',
        updatedValue: 'first_update',
        finalValue: 'final_update',
      });
    });

    it('should handle session deletion completely', async () => {
      // Create session
      await service.createSession(mockUserId, {
        cache: { data: 'to_be_deleted' },
      });

      // Verify session exists
      let session = await service.getSession(mockUserId);
      expect(session).toBeTruthy();

      // Delete session
      await service.deleteSession(mockUserId);

      // Verify session is gone
      session = await service.getSession(mockUserId);
      expect(session).toBeNull();
    });
  });

  describe('Complex Data Structure Persistence', () => {
    it('should persist and retrieve deeply nested objects', async () => {
      const complexData: Partial<SessionData> = {
        conversationState: {
          currentStep: 'complex_step',
          availableSteps: ['step1', 'step2', 'step3'],
          context: {
            user: {
              profile: {
                personal: {
                  name: { first: 'John', last: 'Doe' },
                  contact: {
                    email: 'john@example.com',
                    phone: { country: '+1', number: '5551234567' },
                  },
                },
                preferences: {
                  communication: { email: true, sms: false, push: true },
                  privacy: { analytics: false, marketing: true },
                },
              },
              activity: {
                session: { loginTime: new Date(), interactions: 5 },
                history: [
                  { action: 'login', timestamp: new Date() },
                  { action: 'navigate', timestamp: new Date(), data: { page: 'profile' } },
                ],
              },
            },
            application: {
              state: {
                currentPage: 'dashboard',
                navigation: {
                  breadcrumb: ['home', 'profile', 'settings'],
                  history: ['home', 'profile'],
                },
                ui: {
                  modals: { confirmDialog: { visible: false } },
                  notifications: [{ id: '1', type: 'info', message: 'Welcome!', timestamp: new Date() }],
                },
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
              security: true,
              marketing: false,
              updates: true,
              reminders: { personal: true, business: false },
            },
          },
          display: {
            theme: 'dark',
            timezone: 'America/New_York',
            dateFormat: 'MM/DD/YYYY',
            numberFormat: 'en-US',
          },
          privacy: {
            shareAnalytics: false,
            shareUsageData: true,
            allowDataExport: true,
          },
        },
        cache: {
          apiResponses: {
            userProfile: {
              data: { id: '123', name: 'John Doe', verified: true },
              timestamp: Date.now(),
              expiry: Date.now() + 3600000,
            },
            balance: {
              amount: 156.78,
              currency: 'USD',
              lastUpdate: Date.now(),
              breakdown: { available: 156.78, pending: 0, locked: 0 },
            },
          },
          computedValues: {
            userScore: 85.5,
            recommendations: [
              { id: 'rec1', type: 'product', score: 0.95 },
              { id: 'rec2', type: 'service', score: 0.87 },
            ],
          },
        },
      };

      // Create session with complex data
      const session = await service.createSession(mockUserId, complexData);

      expect(session).toBeDefined();

      // Retrieve and verify deep structure preservation
      const retrievedSession = await service.getSession(mockUserId);

      expect(retrievedSession).toBeTruthy();

      // Test deep nested access
      expect(retrievedSession!.data.conversationState?.context.user.profile.personal.name.first).toBe('John');
      expect(retrievedSession!.data.conversationState?.context.user.profile.personal.contact.phone.number).toBe(
        '5551234567',
      );

      expect(retrievedSession!.data.conversationState?.context.application.state.navigation.breadcrumb).toEqual([
        'home',
        'profile',
        'settings',
      ]);

      expect(retrievedSession!.data.preferences?.notifications?.categories?.reminders?.personal).toBe(true);
      expect(retrievedSession!.data.cache?.apiResponses?.balance?.breakdown?.available).toBe(156.78);

      // Test array preservation
      expect(retrievedSession!.data.conversationState?.context.user.activity.history).toHaveLength(2);
      expect(retrievedSession!.data.cache?.computedValues?.recommendations).toHaveLength(2);
    });

    it('should handle circular references and complex objects safely', async () => {
      // Create object with potential circular reference (should be handled by JSON serialization)
      const dataWithCircular: any = {
        cache: {
          userData: { id: '123', name: 'Test' },
        },
      };

      // Add a reference back (simulating what could cause circular reference)
      dataWithCircular.cache.userData.parent = dataWithCircular.cache;

      // This should not throw an error due to JSON serialization handling
      const session = await service.createSession(mockUserId, dataWithCircular);
      const retrieved = await service.getSession(mockUserId);

      expect(retrieved).toBeTruthy();
      expect(retrieved!.data.cache?.userData?.id).toBe('123');
    });

    it('should preserve data types across persistence operations', async () => {
      const typedData: Partial<SessionData> = {
        cache: {
          string: 'text',
          number: 42,
          boolean: true,
          date: new Date('2023-01-01T00:00:00Z'),
          array: [1, 'two', true, { nested: 'object' }],
          null_value: null,
          undefined_value: undefined,
          object: {
            nested: {
              deeply: {
                value: 'preserved',
              },
            },
          },
        },
      };

      await service.createSession(mockUserId, typedData);
      const retrieved = await service.getSession(mockUserId);

      expect(retrieved).toBeTruthy();

      // Test type preservation
      expect(typeof retrieved!.data.cache?.string).toBe('string');
      expect(typeof retrieved!.data.cache?.number).toBe('number');
      expect(typeof retrieved!.data.cache?.boolean).toBe('boolean');
      expect(retrieved!.data.cache?.date).toBeInstanceOf(Date); // Dates should be restored as Date objects
      expect(Array.isArray(retrieved!.data.cache?.array)).toBe(true);
      expect(retrieved!.data.cache?.null_value).toBeNull();
      expect(retrieved!.data.cache?.object?.nested?.deeply?.value).toBe('preserved');
    });
  });

  describe('Session Consistency and Atomicity', () => {
    it('should maintain consistency during concurrent updates', async () => {
      // Create initial session
      await service.createSession(mockUserId, {
        cache: { counter: 0, operations: [] },
      });

      // Simulate concurrent updates
      const concurrentUpdates = Array(10)
        .fill(null)
        .map(async (_, index) => {
          await service.updateSession(mockUserId, {
            cache: {
              [`operation_${index}`]: `value_${index}`,
              operations: [{ index, timestamp: Date.now() }],
            },
          });
        });

      await Promise.all(concurrentUpdates);

      // Verify final consistency
      const finalSession = await service.getSession(mockUserId);

      expect(finalSession).toBeTruthy();

      // All operations should be present
      for (let i = 0; i < 10; i++) {
        expect(finalSession!.data.cache?.[`operation_${i}`]).toBe(`value_${i}`);
      }
    });

    it('should handle update conflicts gracefully', async () => {
      await service.createSession(mockUserId, {
        cache: { conflictField: 'initial' },
      });

      // Simulate conflict scenario
      const update1 = service.updateSession(mockUserId, {
        cache: { conflictField: 'update1', timestamp1: Date.now() },
      });

      const update2 = service.updateSession(mockUserId, {
        cache: { conflictField: 'update2', timestamp2: Date.now() },
      });

      await Promise.all([update1, update2]);

      const finalSession = await service.getSession(mockUserId);
      expect(finalSession).toBeTruthy();

      // One of the updates should have won
      expect(['update1', 'update2']).toContain(finalSession!.data.cache?.conflictField);
    });

    it('should maintain data integrity during partial failures', async () => {
      await service.createSession(mockUserId, {
        cache: { safeData: 'preserved' },
      });

      // Mock a failure during update
      const originalSetHash = mockRedisCacheService.setHash;
      let failureSimulated = false;

      mockRedisCacheService.setHash.mockImplementationOnce(async (key, hash, ttl) => {
        if (!failureSimulated) {
          failureSimulated = true;
          throw new Error('Simulated Redis failure');
        }

        return originalSetHash(key, hash, ttl);
      });

      // First update should fail
      await expect(
        service.updateSession(mockUserId, {
          cache: { dangerousData: 'should_not_persist' },
        }),
      ).rejects.toThrow('Simulated Redis failure');

      // Second update should succeed
      await service.updateSession(mockUserId, {
        cache: { safeUpdate: 'should_persist' },
      });

      // Verify data integrity
      const session = await service.getSession(mockUserId);
      expect(session!.data.cache?.safeData).toBe('preserved');
      expect(session!.data.cache?.safeUpdate).toBe('should_persist');
      expect(session!.data.cache?.dangerousData).toBeUndefined();
    });
  });

  describe('Cross-Session Persistence', () => {
    it('should maintain data across multiple session instances', async () => {
      const sessionKey = `${sessionKeyPrefix}${mockUserId}`;

      // Create session with first service instance
      await service.createSession(mockUserId, {
        cache: { persistentData: 'should_survive' },
      });

      // Simulate new service instance (like bot restart)
      const newService = module.get<SessionService>(SessionService);

      // Retrieve with new instance
      const retrievedSession = await newService.getSession(mockUserId);

      expect(retrievedSession).toBeTruthy();
      expect(retrievedSession!.data.cache?.persistentData).toBe('should_survive');
    });

    it('should handle session migration between versions', async () => {
      // Simulate old session format
      const oldSessionData = {
        userId: mockUserId,
        // Old format without some new fields
        data: {
          oldField: 'legacy_value',
          cache: { version: '1.0' },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      // Manually insert old format
      await mockRedisCacheService.setHash(`${sessionKeyPrefix}${mockUserId}`, { session: oldSessionData });

      // Retrieve with current service (should handle old format)
      const session = await service.getSession(mockUserId);

      expect(session).toBeTruthy();
      expect(session!.userId).toBe(mockUserId);

      // Update should migrate to new format
      await service.updateSession(mockUserId, {
        conversationState: {
          currentStep: 'migrated',
          availableSteps: [],
          context: {},
          isActive: true,
          startedAt: new Date(),
        },
      });

      const migratedSession = await service.getSession(mockUserId);
      expect(migratedSession!.data.conversationState?.currentStep).toBe('migrated');
    });

    it('should handle persistence across service restarts', async () => {
      const persistentData = {
        conversationState: {
          currentStep: 'important_step',
          availableSteps: ['next1', 'next2'],
          context: { criticalData: 'must_not_lose' },
          isActive: true,
          startedAt: new Date(),
        },
        cache: {
          importantCache: { data: 'valuable_info', timestamp: Date.now() },
        },
      };

      // Create session
      await service.createSession(mockUserId, persistentData);

      // Simulate service restart by creating new module
      const restartedModule = await Test.createTestingModule({
        providers: [SessionService, { provide: RedisCacheService, useValue: mockRedisCacheService }],
      }).compile();

      const restartedService = restartedModule.get<SessionService>(SessionService);

      // Verify data survived restart
      const survivedSession = await restartedService.getSession(mockUserId);

      expect(survivedSession).toBeTruthy();
      expect(survivedSession!.data.conversationState?.currentStep).toBe('important_step');
      expect(survivedSession!.data.conversationState?.context.criticalData).toBe('must_not_lose');
      expect(survivedSession!.data.cache?.importantCache?.data).toBe('valuable_info');

      await restartedModule.close();
    });
  });

  describe('Large Dataset Handling', () => {
    it('should handle large session data efficiently', async () => {
      // Create large dataset
      const largeData: Partial<SessionData> = {
        cache: {},
      };

      // Generate large cache object (1000 items with substantial data)
      for (let i = 0; i < 1000; i++) {
        largeData.cache![`item_${i}`] = {
          id: i,
          data: `large_data_content_${i}`.repeat(50), // ~1KB per item
          metadata: {
            created: new Date(),
            tags: [`tag1_${i}`, `tag2_${i}`, `tag3_${i}`],
            nested: {
              level1: { level2: { level3: `deep_value_${i}` } },
            },
          },
          array: new Array(100).fill(null).map((_, idx) => ({ index: idx, value: `array_item_${i}_${idx}` })),
        };
      }

      const startTime = Date.now();

      // Create session with large data
      const session = await service.createSession(mockUserId, largeData);
      const createDuration = Date.now() - startTime;

      expect(session).toBeDefined();
      expect(createDuration).toBeLessThan(5000); // Should complete under 5 seconds

      // Retrieve large data
      const retrieveStart = Date.now();
      const retrievedSession = await service.getSession(mockUserId);
      const retrieveDuration = Date.now() - retrieveStart;

      expect(retrievedSession).toBeTruthy();
      expect(retrieveDuration).toBeLessThan(2000); // Should retrieve under 2 seconds

      // Verify data integrity
      expect(Object.keys(retrievedSession!.data.cache!)).toHaveLength(1000);
      expect(retrievedSession!.data.cache!.item_500.metadata.nested.level1.level2.level3).toBe('deep_value_500');
    });

    it('should handle memory efficiently with large datasets', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process multiple large sessions
      for (let sessionIndex = 0; sessionIndex < 5; sessionIndex++) {
        const userId = `large_session_user_${sessionIndex}`;
        const largeData: Partial<SessionData> = { cache: {} };

        // Create moderately large dataset per session
        for (let i = 0; i < 200; i++) {
          largeData.cache![`item_${i}`] = {
            data: `content_${sessionIndex}_${i}`.repeat(20),
            metadata: { session: sessionIndex, item: i },
          };
        }

        await service.createSession(userId, largeData);
        const retrieved = await service.getSession(userId);
        expect(retrieved).toBeTruthy();

        // Clean up to test memory management
        await service.deleteSession(userId);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Session Backup and Recovery', () => {
    it('should support session data export', async () => {
      const testData: Partial<SessionData> = {
        conversationState: {
          currentStep: 'backup_test',
          availableSteps: ['step1', 'step2'],
          context: { important: 'data' },
          isActive: true,
          startedAt: new Date(),
        },
        cache: { backupData: 'critical_info' },
      };

      await service.createSession(mockUserId, testData);

      // Simulate backup export
      const session = await service.getSession(mockUserId);
      const exportedData = JSON.stringify(session);

      expect(exportedData).toBeDefined();
      expect(JSON.parse(exportedData)).toMatchObject({
        userId: mockUserId,
        data: expect.objectContaining({
          conversationState: expect.objectContaining({
            currentStep: 'backup_test',
          }),
        }),
      });
    });

    it('should support session data import/restore', async () => {
      // Create original session
      const originalData: Partial<SessionData> = {
        conversationState: {
          currentStep: 'original',
          availableSteps: ['step1'],
          context: { original: true },
          isActive: true,
          startedAt: new Date(),
        },
        cache: { originalCache: 'original_value' },
      };

      const originalSession = await service.createSession(mockUserId, originalData);

      // Export session data
      const exportedData = JSON.stringify(originalSession);

      // Delete original session
      await service.deleteSession(mockUserId);

      // Verify deletion
      let session = await service.getSession(mockUserId);
      expect(session).toBeNull();

      // Restore from backup
      const backupData = JSON.parse(exportedData);
      const restoredSession = await service.createSession(
        mockUserId,
        backupData.data,
        Math.floor((new Date(backupData.expiresAt).getTime() - Date.now()) / 1000),
      );

      // Verify restoration
      session = await service.getSession(mockUserId);
      expect(session).toBeTruthy();
      expect(session!.data.conversationState?.currentStep).toBe('original');
      expect(session!.data.cache?.originalCache).toBe('original_value');
    });
  });

  describe('TTL and Expiration Management', () => {
    it('should handle TTL inheritance during updates', async () => {
      // Create session with specific TTL
      const initialTtl = 3600; // 1 hour
      await service.createSession(mockUserId, { cache: { initial: true } }, initialTtl);

      // Update without specifying TTL (should inherit)
      await service.updateSession(mockUserId, {
        cache: { updated: true },
      });

      // Verify TTL is maintained
      const currentTtl = await mockRedisCacheService.ttl(`${sessionKeyPrefix}${mockUserId}`);
      expect(currentTtl).toBeGreaterThan(0);
      expect(currentTtl).toBeLessThanOrEqual(initialTtl);
    });

    it('should handle TTL updates correctly', async () => {
      await service.createSession(mockUserId, { cache: { test: true } }, 1800); // 30 minutes

      // Update with new TTL
      const newTtl = 7200; // 2 hours
      await service.updateSession(
        mockUserId,
        {
          cache: { updated: true },
        },
        newTtl,
      );

      // Verify new TTL
      const currentTtl = await mockRedisCacheService.ttl(`${sessionKeyPrefix}${mockUserId}`);
      expect(currentTtl).toBeCloseTo(newTtl, -1); // Within 10 seconds
    });

    it('should handle session extension properly', async () => {
      await service.createSession(mockUserId, { cache: { test: true } }, 1800);

      const originalTtl = await mockRedisCacheService.ttl(`${sessionKeyPrefix}${mockUserId}`);

      // Extend session
      const extensionMs = 3600000; // 1 hour
      const extended = await service.extendSession(mockUserId, extensionMs);

      expect(extended).toBe(true);

      const newTtl = await mockRedisCacheService.ttl(`${sessionKeyPrefix}${mockUserId}`);
      expect(newTtl).toBeGreaterThan(originalTtl);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle partial Redis failures gracefully', async () => {
      await service.createSession(mockUserId, { cache: { important: 'data' } });

      // Simulate read failure
      mockRedisCacheService.getHash.mockRejectedValueOnce(new Error('Redis read error'));

      const session = await service.getSession(mockUserId);
      expect(session).toBeNull(); // Should return null on failure, not throw

      // Should log error
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to retrieve session'),
        expect.any(Object),
      );
    });

    it('should maintain data consistency during Redis instability', async () => {
      await service.createSession(mockUserId, { cache: { stable: 'data' } });

      // Simulate intermittent failures
      let callCount = 0;
      const originalSetHash = mockRedisCacheService.setHash;

      mockRedisCacheService.setHash.mockImplementation(async (key, hash, ttl) => {
        callCount++;
        if (callCount % 2 === 0) {
          throw new Error('Intermittent Redis failure');
        }

        return originalSetHash(key, hash, ttl);
      });

      // Some updates should fail, others succeed
      try {
        await service.updateSession(mockUserId, { cache: { attempt1: 'should_succeed' } });
      } catch (error) {
        // First call should succeed
      }

      try {
        await service.updateSession(mockUserId, { cache: { attempt2: 'should_fail' } });
      } catch (error) {
        // Second call should fail
        expect(error).toBeDefined();
      }

      // Reset mock
      mockRedisCacheService.setHash.mockImplementation(originalSetHash);

      // Verify data consistency
      const session = await service.getSession(mockUserId);
      expect(session!.data.cache?.stable).toBe('data');
      expect(session!.data.cache?.attempt1).toBe('should_succeed');
      expect(session!.data.cache?.attempt2).toBeUndefined();
    });
  });
});
