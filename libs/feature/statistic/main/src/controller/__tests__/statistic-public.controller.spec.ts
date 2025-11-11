/* eslint-disable no-await-in-loop */
import { Test, TestingModule } from '@nestjs/testing';
import { StatisticPublicController } from '../statistic-public.controller';
import { StatisticService } from '../../service';
import { StatisticMapper } from '../../mapper';
import { ChartInterval, StatisticType } from '../../dto';

describe('StatisticPublicController', () => {
  let controller: StatisticPublicController;
  let service: jest.Mocked<StatisticService>;
  let mapper: jest.Mocked<StatisticMapper>;

  const mockUserId = 'user-123';
  const mockShareToken = `tra-${mockUserId}-${Date.now()}-abc123`;

  beforeEach(async () => {
    const mockService = {
      getSharedStatistic: jest.fn().mockResolvedValue({
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
        shareLink: `https://motivbuy.com/share/stats/${mockShareToken}`,
      }),
      getSharedLineChartData: jest.fn().mockResolvedValue({
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
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatisticPublicController],
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

    controller = module.get<StatisticPublicController>(StatisticPublicController);
    service = module.get(StatisticService);
    mapper = module.get(StatisticMapper);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPublicStatisticsSummary', () => {
    it('should return public statistics with valid share token', async () => {
      const result = await controller.getPublicStatisticsSummary(mockShareToken);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toBeDefined();
        expect(result.val.shareLink).toContain(mockShareToken);
        expect(service.getSharedStatistic).toHaveBeenCalledWith(mockShareToken);
        expect(mapper.toStatisticResponse).toHaveBeenCalled();
      }
    });

    it('should handle traffic source share tokens', async () => {
      const sourceToken = `tra-${mockUserId}-${Date.now()}-xyz789`;

      await controller.getPublicStatisticsSummary(sourceToken);

      expect(service.getSharedStatistic).toHaveBeenCalledWith(sourceToken);
    });

    it('should handle traffic order share tokens', async () => {
      const orderToken = `ord-${mockUserId}-${Date.now()}-xyz789`;

      await controller.getPublicStatisticsSummary(orderToken);

      expect(service.getSharedStatistic).toHaveBeenCalledWith(orderToken);
    });

    it('should handle traffic target share tokens', async () => {
      const targetToken = `tar-${mockUserId}-${Date.now()}-xyz789`;

      await controller.getPublicStatisticsSummary(targetToken);

      expect(service.getSharedStatistic).toHaveBeenCalledWith(targetToken);
    });

    it('should handle user share tokens', async () => {
      const userToken = `use-${mockUserId}-${Date.now()}-xyz789`;

      await controller.getPublicStatisticsSummary(userToken);

      expect(service.getSharedStatistic).toHaveBeenCalledWith(userToken);
    });
  });

  describe('getPublicChartData', () => {
    it('should return public chart data with valid share token', async () => {
      const query = {
        type: StatisticType.TrafficSource,
        fromDate: '2024-01-01',
        endDate: '2024-01-31',
        interval: ChartInterval.Day,
      };

      const result = await controller.getPublicChartData(mockShareToken, query);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toBeDefined();
        expect(result.val.dataPoints).toHaveLength(2);
        expect(result.val.totalActions).toBe(25);
        expect(service.getSharedLineChartData).toHaveBeenCalledWith(mockShareToken, query);
        expect(mapper.toLineChartResponse).toHaveBeenCalled();
      }
    });

    it('should support all chart intervals', async () => {
      const intervals = [ChartInterval.Hour, ChartInterval.Day, ChartInterval.Week, ChartInterval.Month];

      for (const interval of intervals) {
        const query = {
          type: StatisticType.TrafficSource,
          fromDate: '2024-01-01',
          endDate: '2024-01-31',
          interval,
        };

        await controller.getPublicChartData(mockShareToken, query);

        expect(service.getSharedLineChartData).toHaveBeenCalledWith(mockShareToken, query);
      }

      expect(service.getSharedLineChartData).toHaveBeenCalledTimes(intervals.length);
    });

    it('should handle date ranges properly', async () => {
      const testCases = [
        { fromDate: '2024-01-01', endDate: '2024-01-02' }, // 1 day
        { fromDate: '2024-01-01', endDate: '2024-01-31' }, // 1 month
        { fromDate: '2024-01-01', endDate: '2024-03-31' }, // 3 months
        { fromDate: '2024-01-01', endDate: '2024-12-31' }, // 1 year
      ];

      for (const { fromDate, endDate } of testCases) {
        const query = {
          type: StatisticType.TrafficSource,
          fromDate,
          endDate,
          interval: ChartInterval.Day,
        };

        await controller.getPublicChartData(mockShareToken, query);

        expect(service.getSharedLineChartData).toHaveBeenCalledWith(mockShareToken, query);
      }

      expect(service.getSharedLineChartData).toHaveBeenCalledTimes(testCases.length);
    });

    it('should work without optional interval parameter', async () => {
      const query = {
        type: StatisticType.TrafficSource,
        fromDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      await controller.getPublicChartData(mockShareToken, query);

      expect(service.getSharedLineChartData).toHaveBeenCalledWith(mockShareToken, query);
    });
  });

  describe('Share Token Security', () => {
    it('should not allow access with expired tokens', async () => {
      const expiredTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
      const expiredToken = `tra-${mockUserId}-${expiredTimestamp}-expired`;

      service.getSharedStatistic.mockRejectedValueOnce(new Error('Share token has expired'));

      await expect(controller.getPublicStatisticsSummary(expiredToken)).rejects.toThrow('Share token has expired');
    });

    it('should not allow access with malformed tokens', async () => {
      const malformedToken = 'malformed-token';

      service.getSharedStatistic.mockRejectedValueOnce(new Error('Invalid share token format'));

      await expect(controller.getPublicStatisticsSummary(malformedToken)).rejects.toThrow('Invalid share token format');
    });

    it('should not allow access with invalid type hash', async () => {
      const invalidToken = `inv-${mockUserId}-${Date.now()}-abc123`;

      service.getSharedStatistic.mockRejectedValueOnce(new Error('Invalid share token type'));

      await expect(controller.getPublicStatisticsSummary(invalidToken)).rejects.toThrow('Invalid share token type');
    });
  });
});
