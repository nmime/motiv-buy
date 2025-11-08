import { TrafficSourceEntity, TrafficSourceType } from '@app/database';

/**
 * Repository interface for traffic source operations
 */
export interface ITrafficSourceRepository {
  /**
   * Create new traffic source
   */
  create(data: {
    name: string;
    description?: string;
    type: TrafficSourceType;
    botToken?: string;
    botUsername?: string;
    telegramId?: string;
    managedById?: string;
  }): Promise<TrafficSourceEntity>;

  /**
   * Find traffic source by ID
   */
  findById(id: string): Promise<TrafficSourceEntity | null>;

  /**
   * Find traffic source by bot username
   */
  findByBotUsername(botUsername: string): Promise<TrafficSourceEntity | null>;

  /**
   * Find traffic source by telegram ID
   */
  findByTelegramId(telegramId: string): Promise<TrafficSourceEntity | null>;

  /**
   * Find traffic sources by manager
   */
  findByManager(managerId: string): Promise<TrafficSourceEntity[]>;

  /**
   * Find active traffic sources
   */
  findActive(): Promise<TrafficSourceEntity[]>;

  /**
   * Update traffic source
   */
  update(id: string, data: Partial<TrafficSourceEntity>): Promise<TrafficSourceEntity>;

  /**
   * Soft delete traffic source
   */
  deactivate(id: string): Promise<void>;

  /**
   * Validate bot token if provided
   */
  validateBotToken(botToken: string): Promise<boolean>;

  /**
   * Check if source exists and is accessible by user
   */
  validateSourceAccess(sourceId: string, userId: string): Promise<boolean>;
}
