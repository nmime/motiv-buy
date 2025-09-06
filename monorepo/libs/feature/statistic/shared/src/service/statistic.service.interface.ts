import { StatisticQueryDto, StatisticResponseDto } from '../dto';

export interface IStatisticService {
  /**
   * Get statistic with optional filtering
   */
  getStatistic(userId: string, query: StatisticQueryDto): Promise<StatisticResponseDto>;

  /**
   * Get shareable statistic by share token
   */
  getSharedStatistic(shareToken: string): Promise<StatisticResponseDto>;
}
