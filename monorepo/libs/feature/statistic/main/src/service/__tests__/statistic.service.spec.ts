import { Test, TestingModule } from '@nestjs/testing';
import { StatisticService } from '../statistic.service';
import { StatisticRepository } from '../../repository';
import {
  TrafficOrderRepository,
  TrafficSourceRepository,
  TrafficActionsRepository,
  UserRepository,
} from '@app/database';
import { EntityManager } from '@mikro-orm/core';
import { StatisticType, ChartInterval } from '../../dto';

describe('StatisticService', () => {
  let service: StatisticService;
  let statisticRepository: jest.Mocked<StatisticRepository>;
  let entityManager: jest.Mocked<EntityManager>;

  const mockUserId = 'user-123';

  beforeEach(async () => {
    const mockEntityManager = {
      getConnection: jest.fn().mockReturnValue({
        execute: jest.fn().mockResolvedValue([]),
      }),
    };

    const mockStatisticRepository = {
      getTimeSeriesData: jest.fn().mockResolvedValue([
        { date: '2024-01-01', count: 10, amount: 100 },
        { date: '2024-01-02', count: 15, amount: 150 },
      ]),
      getUserStatistics: jest.fn().mockResolvedValue({
        totalUsers: 100,
        activeUsers: 80,
        totalTransactions: 500,
        netBalanceChange: 5000,
      }),
    };

    const mockTrafficOrderRepository = {
      count: jest.fn().mockResolvedValue(10),
      find: jest.fn().mockResolvedValue([]),
    };

    const mockTrafficSourceRepository = {
      count: jest.fn().mockResolvedValue(5),
      find: jest.fn().mockResolvedValue([]),
    };

    const mockTrafficActionsRepository = {
      count: jest.fn().mockResolvedValue(20),
      find: jest.fn().mockResolvedValue([]),
    };

    const mockUserRepository = {
      count: jest.fn().mockResolvedValue(100),
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticService,
        {
          provide: StatisticRepository,
          useValue: mockStatisticRepository,
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
        {
          provide: TrafficOrderRepository,
          useValue: mockTrafficOrderRepository,
        },
        {
          provide: TrafficSourceRepository,
          useValue: mockTrafficSourceRepository,
        },
        {
          provide: TrafficActionsRepository,
          useValue: mockTrafficActionsRepository,
        },
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<StatisticService>(StatisticService);
    statisticRepository = module.get(StatisticRepository);
    entityManager = module.get(EntityManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLineChartData', () => {
    it('should return chart data with valid date range', async () => {
      const query = {
        type: StatisticType.TrafficSource,
        fromDate: '2024-01-01',
        endDate: '2024-01-31',
        interval: ChartInterval.Day,
      };

      const result = await service.getLineChartData(mockUserId, query);

      expect(result).toBeDefined();
      expect(result.type).toBe(StatisticType.TrafficSource);
      expect(result.dataPoints).toHaveLength(2);
      expect(result.totalActions).toBe(25);
      expect(result.totalAmount).toBe(250);
      expect(statisticRepository.getTimeSeriesData).toHaveBeenCalledWith(
        mockUserId,
        'source',
        undefined,
        expect.any(Object),
        ChartInterval.Day,
      );
    });

    it('should throw error if fromDate is missing', async () => {
      const query = {
        type: StatisticType.TrafficSource,
        endDate: '2024-01-31',
        interval: ChartInterval.Day,
      } as any;

      await expect(service.getLineChartData(mockUserId, query)).rejects.toThrow(
        'Both fromDate and endDate are required for chart data',
      );
    });

    it('should throw error if endDate is missing', async () => {
      const query = {
        type: StatisticType.TrafficSource,
        fromDate: '2024-01-01',
        interval: ChartInterval.Day,
      } as any;

      await expect(service.getLineChartData(mockUserId, query)).rejects.toThrow(
        'Both fromDate and endDate are required for chart data',
      );
    });

    it('should throw error if fromDate is after endDate', async () => {
      const query = {
        type: StatisticType.TrafficSource,
        fromDate: '2024-12-31',
        endDate: '2024-01-01',
        interval: ChartInterval.Day,
      };

      await expect(service.getLineChartData(mockUserId, query)).rejects.toThrow(
        'fromDate must be before endDate',
      );
    });

    it('should throw error if date range exceeds 1 year', async () => {
      const query = {
        type: StatisticType.TrafficSource,
        fromDate: '2023-01-01',
        endDate: '2024-12-31',
        interval: ChartInterval.Day,
      };

      await expect(service.getLineChartData(mockUserId, query)).rejects.toThrow(
        'Date range cannot exceed 1 year',
      );
    });

    it('should throw error for invalid date format', async () => {
      const query = {
        type: StatisticType.TrafficSource,
        fromDate: 'invalid-date',
        endDate: '2024-01-31',
        interval: ChartInterval.Day,
      };

      await expect(service.getLineChartData(mockUserId, query)).rejects.toThrow(
        'Invalid date format. Use YYYY-MM-DD or ISO 8601',
      );
    });

    it('should handle traffic order chart data with negative amounts', async () => {
      const query = {
        type: StatisticType.TrafficOrder,
        fromDate: '2024-01-01',
        endDate: '2024-01-31',
        interval: ChartInterval.Day,
      };

      const result = await service.getLineChartData(mockUserId, query);

      expect(result).toBeDefined();
      expect(result.type).toBe(StatisticType.TrafficOrder);
      expect(result.dataPoints[0].amountEarnedOrSpent).toBe(-100); // Negative for spending
      expect(statisticRepository.getTimeSeriesData).toHaveBeenCalledWith(
        mockUserId,
        'order',
        undefined,
        expect.any(Object),
        ChartInterval.Day,
      );
    });

    it('should handle traffic target chart data', async () => {
      const query = {
        type: StatisticType.TrafficTarget,
        fromDate: '2024-01-01',
        endDate: '2024-01-31',
        interval: ChartInterval.Week,
      };

      const result = await service.getLineChartData(mockUserId, query);

      expect(result).toBeDefined();
      expect(result.type).toBe(StatisticType.TrafficTarget);
      expect(result.interval).toBe(ChartInterval.Week);
      expect(statisticRepository.getTimeSeriesData).toHaveBeenCalledWith(
        mockUserId,
        'target',
        undefined,
        expect.any(Object),
        ChartInterval.Week,
      );
    });

    it('should handle user chart data with specific userId', async () => {
      const specificUserId = 'specific-user-456';
      const query = {
        type: StatisticType.User,
        fromDate: '2024-01-01',
        endDate: '2024-01-31',
        interval: ChartInterval.Month,
        userId: specificUserId,
      };

      const result = await service.getLineChartData(mockUserId, query);

      expect(result).toBeDefined();
      expect(result.type).toBe(StatisticType.User);
      expect(statisticRepository.getTimeSeriesData).toHaveBeenCalledWith(
        mockUserId,
        'user',
        specificUserId,
        expect.any(Object),
        ChartInterval.Month,
      );
    });

    it('should default to hour interval if not specified', async () => {
      const query = {
        type: StatisticType.TrafficSource,
        fromDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      const result = await service.getLineChartData(mockUserId, query);

      expect(result.interval).toBe(ChartInterval.Hour);
      expect(statisticRepository.getTimeSeriesData).toHaveBeenCalledWith(
        mockUserId,
        'source',
        undefined,
        expect.any(Object),
        ChartInterval.Hour,
      );
    });
  });

  describe('getStatistics', () => {
    it('should throw error if type is missing', async () => {
      const query = {} as any;

      await expect(service.getStatistics(mockUserId, query)).rejects.toThrow('Statistic type is required');
    });

    it('should validate date range for statistics', async () => {
      const query = {
        type: StatisticType.TrafficSource,
        fromDate: '2024-12-31',
        endDate: '2024-01-01',
      };

      // Mock the database response
      entityManager.getConnection().execute = jest.fn().mockResolvedValue([
        { totalReward: 0, uniqueSourcesCount: 0, totalActions: 0 },
      ]);

      await expect(service.getStatistics(mockUserId, query)).rejects.toThrow('fromDate must be before endDate');
    });
  });

  describe('generateShareToken', () => {
    it('should generate a valid share token', () => {
      const query = {
        type: StatisticType.TrafficSource,
      };

      const token = service.generateShareToken(mockUserId, query);

      expect(token).toBeDefined();
      expect(token).toContain(mockUserId);
      expect(token).toContain('tra'); // Type hash for traffic_source
      expect(token.split('-')).toHaveLength(4);
    });

    it('should generate different tokens for different types', () => {
      const sourceToken = service.generateShareToken(mockUserId, { type: StatisticType.TrafficSource });
      const orderToken = service.generateShareToken(mockUserId, { type: StatisticType.TrafficOrder });

      expect(sourceToken).not.toBe(orderToken);
      expect(sourceToken).toContain('tra');
      expect(orderToken).toContain('ord');
    });
  });

  describe('getSharedLineChartData', () => {
    it('should validate and return chart data with valid share token', async () => {
      const shareToken = `tra-${mockUserId}-${Date.now()}-abc123`;
      const query = {
        fromDate: '2024-01-01',
        endDate: '2024-01-31',
        interval: ChartInterval.Day,
      };

      const result = await service.getSharedLineChartData(shareToken, query);

      expect(result).toBeDefined();
      expect(result.type).toBe(StatisticType.TrafficSource);
      expect(statisticRepository.getTimeSeriesData).toHaveBeenCalled();
    });

    it('should throw error for expired share token', async () => {
      const expiredTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
      const expiredToken = `tra-${mockUserId}-${expiredTimestamp}-abc123`;
      const query = {
        fromDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      await expect(service.getSharedLineChartData(expiredToken, query)).rejects.toThrow('Share token has expired');
    });

    it('should throw error for invalid share token format', async () => {
      const invalidToken = 'invalid-token';
      const query = {
        fromDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      await expect(service.getSharedLineChartData(invalidToken, query)).rejects.toThrow('Invalid share token format');
    });

    it('should validate date range for shared chart data', async () => {
      const shareToken = `tra-${mockUserId}-${Date.now()}-abc123`;
      const query = {
        fromDate: '2024-12-31',
        endDate: '2024-01-01',
      };

      await expect(service.getSharedLineChartData(shareToken, query)).rejects.toThrow(
        'fromDate must be before endDate',
      );
    });
  });
});
