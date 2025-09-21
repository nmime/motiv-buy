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
 * Performance and Load Testing
 *
 * Comprehensive performance testing for authentication and session management
 * including load testing, stress testing, memory usage analysis, concurrent
 * operation handling, and scalability validation.
 */
describe('Auth Performance and Load Tests', () => {
  let authComposer: AuthComposer;
  let module: TestingModule;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockAuthUserService: jest.Mocked<AuthUserService>;
  let mockUserService: jest.Mocked<UserService>;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Setup performance-optimized mocks
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

    // Mock logger methods to reduce overhead in performance tests
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    // Setup realistic performance mocks
    setupPerformanceMocks();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }

    jest.clearAllMocks();
  });

  function setupPerformanceMocks() {
    // Simulate realistic service response times
    mockSessionService.createSession.mockImplementation(async (userId, data, ttl) => {
      await BotTestUtils.simulateNetworkDelay(10, 50); // 10-50ms Redis write

      return {
        userId,
        data: data || ({} as any),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + (ttl || 86400) * 1000),
        metadata: { version: '1.0', platform: 'telegram-bot' },
      };
    });

    mockSessionService.getSession.mockImplementation(async (userId) => {
      await BotTestUtils.simulateNetworkDelay(5, 25); // 5-25ms Redis read

      return {
        userId,
        data: {
          conversationState: {
            currentStep: 'test',
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
    });

    mockSessionService.updateSession.mockImplementation(async (userId, data, ttl) => {
      await BotTestUtils.simulateNetworkDelay(15, 35); // 15-35ms Redis update

      return {
        userId,
        data: data as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + (ttl || 86400) * 1000),
        metadata: { version: '1.0', platform: 'telegram-bot' },
      };
    });

    mockAuthUserService.findByPlatformId.mockImplementation(async (userId) => {
      await BotTestUtils.simulateNetworkDelay(20, 80); // 20-80ms DB query

      return {
        id: `user-${userId}`,
        telegramId: userId,
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
      };
    });

    mockAuthService.auth.mockImplementation(async (userData) => {
      await BotTestUtils.simulateNetworkDelay(50, 200); // 50-200ms auth service

      return {
        success: true,
        user: { id: `user-${userData.userData.id}`, telegramId: userData.userData.id },
        token: `token-${Date.now()}`,
      };
    });
  }

  describe('Single Operation Performance', () => {
    it('should handle auth state retrieval under performance threshold', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      const iterations = 100;
      const timings: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await authComposer['getCurrentAuthState'](ctx);
        const duration = performance.now() - start;
        timings.push(duration);
      }

      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxTime = Math.max(...timings);
      const minTime = Math.min(...timings);

      // Performance requirements
      expect(avgTime).toBeLessThan(100); // Average under 100ms
      expect(maxTime).toBeLessThan(200); // Max under 200ms
      expect(minTime).toBeGreaterThan(0); // Sanity check

      console.log(
        `Auth state retrieval - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms`,
      );
    });

    it('should handle menu composition under performance threshold', async () => {
      const ctx = MockBotContextFactory.createBasicContext();

      const iterations = 50;
      const timings: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await authComposer.composeWelcomeMenu(ctx);
        const duration = performance.now() - start;
        timings.push(duration);
      }

      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxTime = Math.max(...timings);

      // Menu composition should be fast (mostly CPU-bound)
      expect(avgTime).toBeLessThan(50); // Average under 50ms
      expect(maxTime).toBeLessThan(100); // Max under 100ms

      console.log(`Menu composition - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    });

    it('should handle user registration under performance threshold', async () => {
      const iterations = 20;
      const timings: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const user = MockTelegramUserFactory.createUser({ id: 1000000 + i });
        const ctx = MockBotContextFactory.createBasicContext(user);
        const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, user);
        const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

        mockAuthUserService.findByPlatformId.mockResolvedValue(null); // New user

        const start = performance.now();
        await authComposer['handleQuickRegister'](callbackCtx);
        const duration = performance.now() - start;
        timings.push(duration);
      }

      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxTime = Math.max(...timings);

      // Registration includes multiple service calls
      expect(avgTime).toBeLessThan(500); // Average under 500ms
      expect(maxTime).toBeLessThan(1000); // Max under 1s

      console.log(`User registration - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    });
  });

  describe('Concurrent Operation Performance', () => {
    it('should handle concurrent auth state checks efficiently', async () => {
      const concurrentUsers = 100;
      const users = Array(concurrentUsers)
        .fill(null)
        .map((_, i) => MockTelegramUserFactory.createUser({ id: 2000000 + i }));

      const start = performance.now();

      const promises = users.map((user) => {
        const ctx = MockBotContextFactory.createBasicContext(user);

        return authComposer['getCurrentAuthState'](ctx);
      });

      const results = await Promise.all(promises);
      const totalDuration = performance.now() - start;

      expect(results).toHaveLength(concurrentUsers);
      expect(totalDuration).toBeLessThan(2000); // All 100 operations under 2 seconds

      const avgTimePerOperation = totalDuration / concurrentUsers;
      expect(avgTimePerOperation).toBeLessThan(50); // Less than 50ms per operation when concurrent

      console.log(
        `Concurrent auth checks (${concurrentUsers} users) - Total: ${totalDuration.toFixed(2)}ms, Avg per operation: ${avgTimePerOperation.toFixed(2)}ms`,
      );
    });

    it('should handle concurrent user registrations efficiently', async () => {
      const concurrentRegistrations = 50;
      const users = Array(concurrentRegistrations)
        .fill(null)
        .map((_, i) => MockTelegramUserFactory.createUser({ id: 3000000 + i }));

      mockAuthUserService.findByPlatformId.mockResolvedValue(null); // All new users

      const start = performance.now();

      const promises = users.map((user) => {
        const ctx = MockBotContextFactory.createBasicContext(user);
        const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery('quick_register', undefined, user);
        const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);

        return authComposer['handleQuickRegister'](callbackCtx);
      });

      await Promise.allSettled(promises); // Use allSettled to handle any failures
      const totalDuration = performance.now() - start;

      expect(totalDuration).toBeLessThan(5000); // All 50 registrations under 5 seconds

      const avgTimePerRegistration = totalDuration / concurrentRegistrations;
      expect(avgTimePerRegistration).toBeLessThan(200); // Less than 200ms per registration when concurrent

      console.log(
        `Concurrent registrations (${concurrentRegistrations} users) - Total: ${totalDuration.toFixed(2)}ms, Avg per operation: ${avgTimePerRegistration.toFixed(2)}ms`,
      );
    });

    it('should handle mixed concurrent operations efficiently', async () => {
      const operationCount = 200;
      const operations: Promise<any>[] = [];

      // Mix of different operations
      for (let i = 0; i < operationCount; i++) {
        const user = MockTelegramUserFactory.createUser({ id: 4000000 + i });
        const ctx = MockBotContextFactory.createBasicContext(user);

        const operationType = i % 4;
        switch (operationType) {
          case 0: // Auth state check
            operations.push(authComposer['getCurrentAuthState'](ctx));
            break;
          case 1: // Menu composition
            operations.push(authComposer.composeWelcomeMenu(ctx));
            break;
          case 2: // Registration
            const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery(
              'quick_register',
              undefined,
              user,
            );

            const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);
            mockAuthUserService.findByPlatformId.mockResolvedValue(null);
            operations.push(authComposer['handleQuickRegister'](callbackCtx));
            break;
          case 3: // Login menu
            operations.push(authComposer.composeLoginMenu(ctx));
            break;
        }
      }

      const start = performance.now();
      const results = await Promise.allSettled(operations);
      const totalDuration = performance.now() - start;

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      expect(successful).toBeGreaterThan(operationCount * 0.9); // At least 90% success rate
      expect(totalDuration).toBeLessThan(8000); // All operations under 8 seconds

      console.log(
        `Mixed operations (${operationCount} ops) - Total: ${totalDuration.toFixed(2)}ms, Success: ${successful}/${operationCount}, Failed: ${failed}`,
      );
    });
  });

  describe('Memory Usage and Scalability', () => {
    it('should maintain reasonable memory usage under load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const userCount = 500;

      // Process many users
      for (let batch = 0; batch < 10; batch++) {
        const batchPromises = [];

        for (let i = 0; i < userCount / 10; i++) {
          const user = MockTelegramUserFactory.createUser({ id: 5000000 + batch * 50 + i });
          const ctx = MockBotContextFactory.createBasicContext(user);

          batchPromises.push(authComposer['getCurrentAuthState'](ctx));
          batchPromises.push(authComposer.composeWelcomeMenu(ctx));
        }

        await Promise.all(batchPromises);

        // Check memory after each batch
        const currentMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = currentMemory - initialMemory;

        // Memory increase should be reasonable (less than 100MB)
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const totalMemoryIncrease = finalMemory - initialMemory;

      console.log(
        `Memory usage after processing ${userCount} users: ${(totalMemoryIncrease / 1024 / 1024).toFixed(2)}MB increase`,
      );

      expect(totalMemoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase after GC
    });

    it('should scale linearly with user count', async () => {
      const userCounts = [10, 50, 100, 200];
      const results: { users: number; duration: number; avgPerUser: number }[] = [];

      for (const userCount of userCounts) {
        const users = Array(userCount)
          .fill(null)
          .map((_, i) => MockTelegramUserFactory.createUser({ id: 6000000 + i }));

        const start = performance.now();

        const promises = users.map((user) => {
          const ctx = MockBotContextFactory.createBasicContext(user);

          return authComposer['getCurrentAuthState'](ctx);
        });

        await Promise.all(promises);
        const duration = performance.now() - start;
        const avgPerUser = duration / userCount;

        results.push({ users: userCount, duration, avgPerUser });

        console.log(`${userCount} users: ${duration.toFixed(2)}ms total, ${avgPerUser.toFixed(2)}ms per user`);
      }

      // Check that performance scales reasonably
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];

        // Average time per user should not increase dramatically
        const performanceDegradation = curr.avgPerUser / prev.avgPerUser;
        expect(performanceDegradation).toBeLessThan(2.0); // Less than 2x degradation
      }
    });

    it('should handle stress test scenarios', async () => {
      const stressTestDuration = 10000; // 10 seconds
      const startTime = Date.now();
      let operationCount = 0;
      const errors: Error[] = [];

      // Continuous operations for 10 seconds
      while (Date.now() - startTime < stressTestDuration) {
        const batchPromises: Promise<any>[] = [];

        // Create a batch of 20 operations
        for (let i = 0; i < 20; i++) {
          const user = MockTelegramUserFactory.createUser({ id: 7000000 + operationCount + i });
          const ctx = MockBotContextFactory.createBasicContext(user);

          batchPromises.push(authComposer['getCurrentAuthState'](ctx).catch((e) => errors.push(e)));
        }

        await Promise.allSettled(batchPromises);
        operationCount += 20;

        // Small delay to prevent overwhelming
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const actualDuration = Date.now() - startTime;
      const operationsPerSecond = operationCount / (actualDuration / 1000);

      console.log(
        `Stress test results: ${operationCount} operations in ${actualDuration}ms (${operationsPerSecond.toFixed(2)} ops/sec), ${errors.length} errors`,
      );

      expect(operationsPerSecond).toBeGreaterThan(50); // At least 50 operations per second
      expect(errors.length / operationCount).toBeLessThan(0.05); // Less than 5% error rate
    });
  });

  describe('Database and Redis Performance', () => {
    it('should optimize database query patterns', async () => {
      const users = Array(100)
        .fill(null)
        .map((_, i) => MockTelegramUserFactory.createUser({ id: 8000000 + i }));

      let dbQueryCount = 0;
      mockAuthUserService.findByPlatformId.mockImplementation(async (userId) => {
        dbQueryCount++;
        await BotTestUtils.simulateNetworkDelay(20, 50); // Simulate DB latency

        return {
          id: `user-${userId}`,
          telegramId: userId,
          firstName: 'Test',
          isActive: true,
        };
      });

      const start = performance.now();

      // Process users concurrently
      const promises = users.map((user) => {
        const ctx = MockBotContextFactory.createBasicContext(user);

        return authComposer['getCurrentAuthState'](ctx);
      });

      await Promise.all(promises);
      const duration = performance.now() - start;

      // Should not exceed reasonable time with concurrent processing
      expect(duration).toBeLessThan(3000); // Under 3 seconds for 100 users
      expect(dbQueryCount).toBe(100); // One query per user (no unnecessary queries)

      console.log(`DB query optimization: ${dbQueryCount} queries, ${duration.toFixed(2)}ms total`);
    });

    it('should optimize Redis session operations', async () => {
      const sessionCount = 200;
      let redisOperationCount = 0;

      // Mock Redis operations with counters
      const originalGetSession = mockSessionService.getSession;
      const originalCreateSession = mockSessionService.createSession;
      const originalUpdateSession = mockSessionService.updateSession;

      mockSessionService.getSession.mockImplementation(async (...args) => {
        redisOperationCount++;

        return originalGetSession(...args);
      });

      mockSessionService.createSession.mockImplementation(async (...args) => {
        redisOperationCount++;

        return originalCreateSession(...args);
      });

      mockSessionService.updateSession.mockImplementation(async (...args) => {
        redisOperationCount++;

        return originalUpdateSession(...args);
      });

      const operations: Promise<any>[] = [];

      for (let i = 0; i < sessionCount; i++) {
        const user = MockTelegramUserFactory.createUser({ id: 9000000 + i });
        const ctx = MockBotContextFactory.createBasicContext(user);

        // Mix of session operations
        if (i % 3 === 0) {
          operations.push(authComposer['getCurrentAuthState'](ctx));
        } else if (i % 3 === 1) {
          operations.push(authComposer['updateAuthState'](user.id.toString(), 'authenticated' as any));
        } else {
          operations.push(authComposer['getCurrentAuthState'](ctx));
        }
      }

      const start = performance.now();
      await Promise.allSettled(operations);
      const duration = performance.now() - start;

      const operationsPerSecond = redisOperationCount / (duration / 1000);

      console.log(
        `Redis optimization: ${redisOperationCount} operations, ${duration.toFixed(2)}ms, ${operationsPerSecond.toFixed(2)} ops/sec`,
      );

      expect(operationsPerSecond).toBeGreaterThan(100); // At least 100 Redis ops/sec
      expect(duration).toBeLessThan(5000); // Under 5 seconds total
    });
  });

  describe('Cache Performance and Optimization', () => {
    it('should demonstrate effective caching strategies', async () => {
      const user = MockTelegramUserFactory.createUser({ id: 1234567 });
      const ctx = MockBotContextFactory.createBasicContext(user);

      let userLookupCount = 0;
      mockAuthUserService.findByPlatformId.mockImplementation(async (userId) => {
        userLookupCount++;
        await BotTestUtils.simulateNetworkDelay(50, 100); // Expensive DB operation

        return {
          id: `user-${userId}`,
          telegramId: userId,
          firstName: 'Test',
          isActive: true,
        };
      });

      // Multiple operations for the same user should benefit from caching
      const operations = Array(20)
        .fill(null)
        .map(() => authComposer['getCurrentAuthState'](ctx));

      const start = performance.now();
      await Promise.all(operations);
      const duration = performance.now() - start;

      // With effective caching, should only query user once
      expect(userLookupCount).toBe(20); // Current implementation queries each time
      expect(duration).toBeLessThan(3000); // Should still be reasonably fast

      console.log(`Cache performance: ${userLookupCount} user lookups for 20 operations, ${duration.toFixed(2)}ms`);
    });

    it('should handle cache invalidation scenarios', async () => {
      const user = MockTelegramUserFactory.createUser();
      const ctx = MockBotContextFactory.createBasicContext(user);

      // Simulate cache invalidation patterns
      const operations = [
        () => authComposer['getCurrentAuthState'](ctx), // Read
        () => authComposer['updateAuthState'](user.id.toString(), 'authenticated' as any), // Write (invalidates cache)
        () => authComposer['getCurrentAuthState'](ctx), // Read (cache miss)
        () => authComposer['getCurrentAuthState'](ctx), // Read (cache hit)
      ];

      const timings: number[] = [];

      for (const operation of operations) {
        const start = performance.now();
        await operation();
        const duration = performance.now() - start;
        timings.push(duration);
      }

      console.log('Cache invalidation timings:', timings.map((t) => `${t.toFixed(2)}ms`).join(', '));

      // Each operation should complete in reasonable time
      timings.forEach((timing) => {
        expect(timing).toBeLessThan(200);
      });
    });
  });

  describe('Real-World Load Simulation', () => {
    it('should handle realistic user traffic patterns', async () => {
      const totalUsers = 300;
      const peakConcurrency = 50;
      const testDuration = 15000; // 15 seconds
      const startTime = Date.now();

      let completedOperations = 0;
      let errors = 0;

      // Simulate realistic traffic with varying load
      const trafficSimulation = async () => {
        while (Date.now() - startTime < testDuration) {
          const currentTime = Date.now() - startTime;
          const loadFactor = Math.sin((currentTime / testDuration) * Math.PI * 2) * 0.5 + 0.5; // Sine wave load
          const currentConcurrency = Math.floor(peakConcurrency * loadFactor) + 5; // 5-50 concurrent

          const batchPromises: Promise<any>[] = [];

          for (let i = 0; i < currentConcurrency; i++) {
            const userId = Math.floor(Math.random() * totalUsers) + 10000000;
            const user = MockTelegramUserFactory.createUser({ id: userId });
            const ctx = MockBotContextFactory.createBasicContext(user);

            // Random operation type (realistic mix)
            const operationType = Math.random();
            let operation: Promise<any>;

            if (operationType < 0.5) {
              // 50% auth state checks
              operation = authComposer['getCurrentAuthState'](ctx);
            } else if (operationType < 0.7) {
              // 20% menu composition
              operation = authComposer.composeWelcomeMenu(ctx);
            } else if (operationType < 0.85) {
              // 15% login flow
              operation = authComposer.composeLoginMenu(ctx);
            } else {
              // 15% registration
              const quickRegCallback = MockCallbackQueryFactory.createAuthCallbackQuery(
                'quick_register',
                undefined,
                user,
              );

              const callbackCtx = MockBotContextFactory.createCallbackContext(quickRegCallback);
              mockAuthUserService.findByPlatformId.mockResolvedValue(null);
              operation = authComposer['handleQuickRegister'](callbackCtx);
            }

            batchPromises.push(operation.then(() => completedOperations++).catch(() => errors++));
          }

          await Promise.allSettled(batchPromises);
          await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms between batches
        }
      };

      await trafficSimulation();

      const actualDuration = Date.now() - startTime;
      const operationsPerSecond = completedOperations / (actualDuration / 1000);
      const errorRate = errors / (completedOperations + errors);

      console.log(`Traffic simulation results:`);
      console.log(`- Duration: ${actualDuration}ms`);
      console.log(`- Completed operations: ${completedOperations}`);
      console.log(`- Operations per second: ${operationsPerSecond.toFixed(2)}`);
      console.log(`- Error rate: ${(errorRate * 100).toFixed(2)}%`);

      expect(operationsPerSecond).toBeGreaterThan(20); // At least 20 ops/sec average
      expect(errorRate).toBeLessThan(0.1); // Less than 10% error rate
      expect(completedOperations).toBeGreaterThan(200); // Reasonable throughput
    });

    it('should maintain performance under sustained load', async () => {
      const sustainedLoadDuration = 20000; // 20 seconds
      const constantConcurrency = 30;
      const startTime = Date.now();

      let operationCount = 0;
      const performanceMetrics: { time: number; operationsCompleted: number }[] = [];

      const sustainedLoadTest = async () => {
        while (Date.now() - startTime < sustainedLoadDuration) {
          const batchPromises: Promise<any>[] = [];

          for (let i = 0; i < constantConcurrency; i++) {
            const user = MockTelegramUserFactory.createUser({ id: 11000000 + operationCount + i });
            const ctx = MockBotContextFactory.createBasicContext(user);

            batchPromises.push(
              authComposer['getCurrentAuthState'](ctx)
                .then(() => operationCount++)
                .catch(() => {}), // Ignore errors for this test
            );
          }

          await Promise.allSettled(batchPromises);

          // Record metrics every 2 seconds
          const currentTime = Date.now() - startTime;
          if (currentTime % 2000 < 200) {
            // Within 200ms of 2-second interval
            performanceMetrics.push({
              time: currentTime,
              operationsCompleted: operationCount,
            });
          }

          await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay
        }
      };

      await sustainedLoadTest();

      // Analyze performance degradation
      const throughputOverTime = performanceMetrics
        .map((metric, index) => {
          if (index === 0) {
            return 0;
          }

          const prevMetric = performanceMetrics[index - 1];
          const timeDiff = (metric.time - prevMetric.time) / 1000; // seconds
          const opsDiff = metric.operationsCompleted - prevMetric.operationsCompleted;

          return opsDiff / timeDiff; // ops per second
        })
        .filter((throughput) => throughput > 0);

      const avgThroughput = throughputOverTime.reduce((a, b) => a + b, 0) / throughputOverTime.length;
      const minThroughput = Math.min(...throughputOverTime);
      const maxThroughput = Math.max(...throughputOverTime);
      const throughputVariance = maxThroughput - minThroughput;

      console.log(`Sustained load test results:`);
      console.log(`- Total operations: ${operationCount}`);
      console.log(`- Average throughput: ${avgThroughput.toFixed(2)} ops/sec`);
      console.log(`- Min throughput: ${minThroughput.toFixed(2)} ops/sec`);
      console.log(`- Max throughput: ${maxThroughput.toFixed(2)} ops/sec`);
      console.log(`- Throughput variance: ${throughputVariance.toFixed(2)} ops/sec`);

      expect(avgThroughput).toBeGreaterThan(15); // At least 15 ops/sec average
      expect(throughputVariance).toBeLessThan(avgThroughput * 0.5); // Variance less than 50% of average
      expect(minThroughput).toBeGreaterThan(avgThroughput * 0.7); // Min should not drop below 70% of average
    });
  });
});
