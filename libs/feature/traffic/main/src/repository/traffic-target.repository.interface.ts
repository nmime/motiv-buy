import { TrafficTargetEntity, TrafficTargetStatus, TrafficTargetType } from '@app/database';

/**
 * Repository interface for traffic target operations
 */
export interface ITrafficTargetRepository {
  /**
   * Create new traffic target
   */
  create(data: {
    name: string;
    description?: string;
    type: TrafficTargetType;
    status: TrafficTargetStatus;
    telegramId?: string;
    username?: string;
    inviteLink?: string;
    pricePerMember?: string;
    minMembers?: number;
    maxMembers?: number;
    managedById?: string;
    requiresApproval?: boolean;
  }): Promise<TrafficTargetEntity>;

  /**
   * Find traffic target by ID
   */
  findById(id: string): Promise<TrafficTargetEntity | null>;

  /**
   * Find traffic target by telegram ID
   */
  findByTelegramId(telegramId: string): Promise<TrafficTargetEntity | null>;

  /**
   * Find traffic target by username
   */
  findByUsername(username: string): Promise<TrafficTargetEntity | null>;

  /**
   * Find traffic targets by manager
   */
  findByManager(managerId: string): Promise<TrafficTargetEntity[]>;

  /**
   * Find active traffic targets
   */
  findActive(): Promise<TrafficTargetEntity[]>;

  /**
   * Update traffic target
   */
  update(id: string, data: Partial<TrafficTargetEntity>): Promise<TrafficTargetEntity>;

  /**
   * Soft delete traffic target
   */
  deactivate(id: string): Promise<void>;

  /**
   * Check if target exists and is accessible by user
   */
  validateTargetAccess(targetId: string, userId: string): Promise<boolean>;
}
