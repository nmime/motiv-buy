import { Test, TestingModule } from '@nestjs/testing';
import { StatisticRepository } from '../statistic.repository';
import { EntityManager } from '@mikro-orm/core';

describe('StatisticRepository', () => {
  let repository: StatisticRepository;
  let entityManager: jest.Mocked<EntityManager>;

  const mockUserId = 'user-123';

  beforeEach(async () => {
    const mockConnection = {
      execute: jest.fn().mockResolvedValue([
        { date: '2024-01-01', count: 10, amount: 100 },
        { date: '2024-01-02', count: 15, amount: 150 },
      ]),
    };

    const mockEntityManager = {
      getConnection: jest.fn().mockReturnValue(mockConnection),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticRepository,
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
      ],
    }).compile();

    repository = module.get<StatisticRepository>(StatisticRepository);
    entityManager = module.get(EntityManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTimeSeriesData', () => {
    it('should return time series data for source type', async () => {
      const dateFilter = {
        fromDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await repository.getTimeSeriesData(mockUserId, 'source', undefined, dateFilter, 'day');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2024-01-01',
        count: 10,
        amount: 100,
      });
      expect(entityManager.getConnection().execute).toHaveBeenCalled();
    });

    it('should return time series data for order type', async () => {
      const dateFilter = {
        fromDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await repository.getTimeSeriesData(mockUserId, 'order', undefined, dateFilter, 'day');

      expect(result).toHaveLength(2);
      expect(entityManager.getConnection().execute).toHaveBeenCalled();
    });

    it('should return time series data for target type', async () => {
      const dateFilter = {
        fromDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await repository.getTimeSeriesData(mockUserId, 'target', undefined, dateFilter, 'day');

      expect(result).toHaveLength(2);
      expect(entityManager.getConnection().execute).toHaveBeenCalled();
    });

    it('should return time series data for user type', async () => {
      const dateFilter = {
        fromDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await repository.getTimeSeriesData(mockUserId, 'user', undefined, dateFilter, 'day');

      expect(result).toHaveLength(2);
      expect(entityManager.getConnection().execute).toHaveBeenCalled();
    });

    it('should support hourly interval', async () => {
      const dateFilter = {
        fromDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02'),
      };

      const result = await repository.getTimeSeriesData(mockUserId, 'source', undefined, dateFilter, 'hour');

      expect(result).toBeDefined();
      expect(entityManager.getConnection().execute).toHaveBeenCalled();
    });

    it('should support weekly interval', async () => {
      const dateFilter = {
        fromDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
      };

      const result = await repository.getTimeSeriesData(mockUserId, 'source', undefined, dateFilter, 'week');

      expect(result).toBeDefined();
      expect(entityManager.getConnection().execute).toHaveBeenCalled();
    });

    it('should support monthly interval', async () => {
      const dateFilter = {
        fromDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      };

      const result = await repository.getTimeSeriesData(mockUserId, 'source', undefined, dateFilter, 'month');

      expect(result).toBeDefined();
      expect(entityManager.getConnection().execute).toHaveBeenCalled();
    });

    it('should filter by resource ID', async () => {
      const resourceId = 'resource-123';
      const dateFilter = {
        fromDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await repository.getTimeSeriesData(mockUserId, 'source', resourceId, dateFilter, 'day');

      expect(result).toBeDefined();
      expect(entityManager.getConnection().execute).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      entityManager.getConnection().execute = jest.fn().mockResolvedValue([]);

      const dateFilter = {
        fromDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await repository.getTimeSeriesData(mockUserId, 'source', undefined, dateFilter, 'day');

      expect(result).toEqual([]);
    });
  });

  describe('getUserStatistics', () => {
    it('should return user statistics', async () => {
      entityManager.getConnection().execute = jest
        .fn()
        .mockResolvedValueOnce([{ total_users: 100, active_users: 80 }])
        .mockResolvedValueOnce([{ total_transactions: 500, net_balance_change: 5000 }]);

      const dateFilter = {
        fromDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await repository.getUserStatistics(mockUserId, dateFilter);

      expect(result).toEqual({
        totalUsers: 100,
        activeUsers: 80,
        totalTransactions: 500,
        netBalanceChange: 5000,
      });
      expect(entityManager.getConnection().execute).toHaveBeenCalledTimes(2);
    });

    it('should handle zero results', async () => {
      entityManager.getConnection().execute = jest
        .fn()
        .mockResolvedValueOnce([{ total_users: 0, active_users: 0 }])
        .mockResolvedValueOnce([{ total_transactions: 0, net_balance_change: 0 }]);

      const result = await repository.getUserStatistics(mockUserId);

      expect(result.totalUsers).toBe(0);
      expect(result.activeUsers).toBe(0);
    });
  });

  describe('getTrafficSourceStatistics', () => {
    it('should return traffic source statistics', async () => {
      entityManager.getConnection().execute = jest.fn().mockResolvedValue([
        {
          unique_sources_count: 5,
          total_actions: 100,
          total_reward: 1000,
        },
      ]);

      const dateFilter = {
        fromDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await repository.getTrafficSourceStatistics(mockUserId, undefined, dateFilter);

      expect(result).toEqual({
        uniqueSourcesCount: 5,
        totalActions: 100,
        totalReward: 1000,
        avgRewardPerAction: 10,
      });
    });

    it('should filter by source ID', async () => {
      const sourceId = 'source-123';

      entityManager.getConnection().execute = jest.fn().mockResolvedValue([
        {
          unique_sources_count: 1,
          total_actions: 50,
          total_reward: 500,
        },
      ]);

      const result = await repository.getTrafficSourceStatistics(mockUserId, sourceId);

      expect(result.uniqueSourcesCount).toBe(1);
    });
  });

  describe('getTrafficTargetStatistics', () => {
    it('should return traffic target statistics', async () => {
      entityManager.getConnection().execute = jest.fn().mockResolvedValue([
        {
          active_targets_count: 10,
          total_orders_count: 50,
          total_earned: 5000,
        },
      ]);

      const dateFilter = {
        fromDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await repository.getTrafficTargetStatistics(mockUserId, undefined, dateFilter);

      expect(result).toEqual({
        activeTargetsCount: 10,
        totalOrdersCount: 50,
        totalEarned: 5000,
        avgPricePerMember: 100,
      });
    });

    it('should filter by target ID', async () => {
      const targetId = 'target-123';

      entityManager.getConnection().execute = jest.fn().mockResolvedValue([
        {
          active_targets_count: 1,
          total_orders_count: 10,
          total_earned: 1000,
        },
      ]);

      const result = await repository.getTrafficTargetStatistics(mockUserId, targetId);

      expect(result.activeTargetsCount).toBe(1);
    });
  });

  describe('getTrafficOrderStatistics', () => {
    it('should return traffic order statistics', async () => {
      entityManager.getConnection().execute = jest.fn().mockResolvedValue([
        {
          total_orders: 20,
          completed_orders: 15,
          pending_orders: 5,
          total_budget: 10000,
          spent_amount: 7500,
        },
      ]);

      const dateFilter = {
        fromDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await repository.getTrafficOrderStatistics(mockUserId, undefined, dateFilter);

      expect(result).toEqual({
        totalOrders: 20,
        completedOrders: 15,
        pendingOrders: 5,
        totalBudget: 10000,
        spentAmount: 7500,
      });
    });

    it('should filter by order ID', async () => {
      const orderId = 'order-123';

      entityManager.getConnection().execute = jest.fn().mockResolvedValue([
        {
          total_orders: 1,
          completed_orders: 1,
          pending_orders: 0,
          total_budget: 1000,
          spent_amount: 750,
        },
      ]);

      const result = await repository.getTrafficOrderStatistics(mockUserId, orderId);

      expect(result.totalOrders).toBe(1);
    });
  });
});
