/* eslint-disable @typescript-eslint/no-explicit-any, no-await-in-loop */
import { Test, TestingModule } from '@nestjs/testing';
import { StatisticController } from '../statistic.controller';
import { StatisticService } from '../../service';
import { StatisticMapper } from '../../mapper';
import { ChartInterval, StatisticType } from '../../dto';

describe('StatisticController', () => {
  let controller: StatisticController;
  let service: jest.Mocked<StatisticService>;
  let mapper: jest.Mocked<StatisticMapper>;

  const mockUserId = 'user-123';

  beforeEach(async () => {
    const mockService = {
      getStatistics: jest.fn().mockResolvedValue({
        data: {
          type: StatisticType.TrafficSource,
          countOfActions: 100,
          amountEarnedOrSpent: 1000,
          period: '2024-01-01 to 2024-01-31',
          generatedAt: new Date(),
          uniqueSourcesCount: 5,
          totalActions: 100,
          avgRewardPerAction: 10,
        },
        shareLink: 'https://motivbuy.com/share/stats/token123',
      }),
      getLineChartData: jest.fn().mockResolvedValue({
        type: StatisticType.TrafficSource,
        dataPoints: [
          { date: '2024-01-01', countOfActions: 10, amountEarnedOrSpent: 100 },
          { date: '2024-01-02', countOfActions: 15, amountEarnedOrSpent: 150 },
        ],
        totalActions: 25,
        totalAmount: 250,
        period: '2024-01-01 to 2024-01-31',
        interval: ChartInterval.Day,
      }),
      generateShareToken: jest.fn().mockReturnValue('token123'),
    };

    const mockMapper = {
      toStatisticResponse: jest.fn().mockImplementation((data) => ({
        data: data.data,
        shareLink: data.shareLink,
      })),
      toLineChartResponse: jest.fn().mockImplementation((data) => ({
        type: data.type,
        dataPoints: data.dataPoints,
        totalActions: data.totalActions,
        totalAmount: data.totalAmount,
        period: data.period,
        interval: data.interval,
        generatedAt: new Date(),
      })),
      toShareTokenResponse: jest.fn().mockImplementation((token) => ({
        shareToken: token,
        shareLink: `https://motivbuy.com/share/stats/${token}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatisticController],
      providers: [
        {
          provide: StatisticService,
          useValue: mockService,
        },
        {
          provide: StatisticMapper,
          useValue: mockMapper,
        },
      ],
    }).compile();

    controller = module.get<StatisticController>(StatisticController);
    service = module.get(StatisticService);
    mapper = module.get(StatisticMapper);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStatisticsSummary', () => {
    it('should return statistics summary', async () => {
      const query = {
        type: StatisticType.TrafficSource,
        fromDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      const result = await controller.getStatisticsSummary(query, mockUserId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toBeDefined();
        expect(result.val.shareLink).toContain('motivbuy.com');
        expect(service.getStatistics).toHaveBeenCalledWith(mockUserId, query);
        expect(mapper.toStatisticResponse).toHaveBeenCalled();
      }
    });

    it('should filter by source ID', async () => {
      const query = {
        type: StatisticType.TrafficSource,
        sourceId: 'source-123',
        fromDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      await controller.getStatisticsSummary(query, mockUserId);

      expect(service.getStatistics).toHaveBeenCalledWith(mockUserId, query);
    });

    it('should filter by order ID', async () => {
      const query = {
        type: StatisticType.TrafficOrder,
        orderId: 'order-123',
        fromDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      await controller.getStatisticsSummary(query, mockUserId);

      expect(service.getStatistics).toHaveBeenCalledWith(mockUserId, query);
    });

    it('should filter by target ID', async () => {
      const query = {
        type: StatisticType.TrafficTarget,
        targetId: 'target-123',
        fromDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      await controller.getStatisticsSummary(query, mockUserId);

      expect(service.getStatistics).toHaveBeenCalledWith(mockUserId, query);
    });
  });

  describe('getChartData', () => {
    it('should return chart data', async () => {
      const query = {
        type: StatisticType.TrafficSource,
        fromDate: '2024-01-01',
        endDate: '2024-01-31',
        interval: ChartInterval.Day,
      };

      const result = await controller.getChartData(query, mockUserId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toBeDefined();
        expect(result.val.dataPoints).toHaveLength(2);
        expect(result.val.totalActions).toBe(25);
        expect(service.getLineChartData).toHaveBeenCalledWith(mockUserId, query);
        expect(mapper.toLineChartResponse).toHaveBeenCalled();
      }
    });

    it('should support hourly interval', async () => {
      const query = {
        type: StatisticType.TrafficSource,
        fromDate: '2024-01-01',
        endDate: '2024-01-02',
        interval: ChartInterval.Hour,
      };

      await controller.getChartData(query, mockUserId);

      expect(service.getLineChartData).toHaveBeenCalledWith(mockUserId, query);
    });

    it('should support weekly interval', async () => {
      const query = {
        type: StatisticType.TrafficSource,
        fromDate: '2024-01-01',
        endDate: '2024-03-31',
        interval: ChartInterval.Week,
      };

      await controller.getChartData(query, mockUserId);

      expect(service.getLineChartData).toHaveBeenCalledWith(mockUserId, query);
    });

    it('should support monthly interval', async () => {
      const query = {
        type: StatisticType.TrafficSource,
        fromDate: '2024-01-01',
        endDate: '2024-12-31',
        interval: ChartInterval.Month,
      };

      await controller.getChartData(query, mockUserId);

      expect(service.getLineChartData).toHaveBeenCalledWith(mockUserId, query);
    });

    it('should handle all statistic types', async () => {
      const types = [
        StatisticType.TrafficSource,
        StatisticType.TrafficOrder,
        StatisticType.TrafficTarget,
        StatisticType.User,
      ];

      for (const type of types) {
        const query = {
          type,
          fromDate: '2024-01-01',
          endDate: '2024-01-31',
          interval: ChartInterval.Day,
        };

        await controller.getChartData(query, mockUserId);

        expect(service.getLineChartData).toHaveBeenCalledWith(mockUserId, query);
      }

      expect(service.getLineChartData).toHaveBeenCalledTimes(types.length);
    });
  });

  describe('generateShareToken', () => {
    it('should generate share token', () => {
      const query = {
        type: StatisticType.TrafficSource,
        fromDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      const result = controller.generateShareToken(query, mockUserId);

      expect(result).toBeDefined();
      expect(result.shareToken).toBe('token123');
      expect(result.shareLink).toContain('motivbuy.com');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(service.generateShareToken).toHaveBeenCalledWith(mockUserId, query);
      expect(mapper.toShareTokenResponse).toHaveBeenCalledWith('token123');
    });

    it('should generate tokens for different types', () => {
      const types = [
        StatisticType.TrafficSource,
        StatisticType.TrafficOrder,
        StatisticType.TrafficTarget,
        StatisticType.User,
      ];

      types.forEach((type) => {
        const query = { type };
        controller.generateShareToken(query, mockUserId);
      });

      expect(service.generateShareToken).toHaveBeenCalledTimes(types.length);
    });
  });
});
