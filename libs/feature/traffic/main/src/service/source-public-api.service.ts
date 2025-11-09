import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { EntityManager, EntityRepository, LockMode } from '@mikro-orm/core';
import { getErrorMessage, add, toDbString, decimal, toNumber } from '@app/common-shared';
import type { Decimal } from 'decimal.js';
import { BotFactoryService } from '@app/feature-bot-shared';
import { targetingFilters } from '../config/targeting-filters.config';
import {
  CheckSubscriptionRequestDto,
  CheckSubscriptionResponseDto,
  CheckTaskStatusRequestDto,
  CheckTaskStatusResponseDto,
  CompleteTaskRequestDto,
  CompleteTaskResponseDto,
  CompletedTaskDto,
  GetCompletedTasksRequestDto,
  GetCompletedTasksResponseDto,
  GetFiltersResponseDto,
  GetSourceInfoRequestDto,
  GetSourceInfoResponseDto,
  GetTasksRequestDto,
  GetTasksResponseDto,
  TaskDto,
} from '@app/feature-traffic-shared';
import {
  CurrencyCode,
  TrafficActionStatus,
  TrafficActionType,
  TrafficActionsEntity,
  TrafficActionsRepository,
  TrafficOrderEntity,
  TrafficOrderRepository,
  TrafficOrderBalanceEntity,
  TrafficOrderBalanceRepository,
  TrafficOrderStatus,
  TrafficOrderType,
  TrafficSourceEntity,
  TrafficSourceRepository,
  TrafficUserEntity,
  TransactionStatus,
  TransactionType,
  UserBalanceHistoryRepository,
  UserBalanceRepository,
} from '@app/database';

/**
 * Type-safe mapper from TrafficOrderType to TrafficActionType
 * All order types map 1:1 to corresponding action types
 */
const _orderTypeToActionType: Record<TrafficOrderType, TrafficActionType> = {
  [TrafficOrderType.Join]: TrafficActionType.Join,
  [TrafficOrderType.Leave]: TrafficActionType.Leave,
  [TrafficOrderType.View]: TrafficActionType.View,
  [TrafficOrderType.Subscribe]: TrafficActionType.Subscribe,
  [TrafficOrderType.Unsubscribe]: TrafficActionType.Unsubscribe,
  [TrafficOrderType.React]: TrafficActionType.React,
  [TrafficOrderType.Comment]: TrafficActionType.Comment,
} as const;

/**
 * Service for Public Traffic Source API
 * Handles public endpoints for traffic sources to interact with platform
 * All methods validate API key and handle balance flow
 */
@Injectable()
export class SourcePublicApiService {
  private readonly logger = new Logger(SourcePublicApiService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly trafficSourceRepository: TrafficSourceRepository,
    private readonly trafficOrderRepository: TrafficOrderRepository,
    private readonly trafficOrderBalanceRepository: TrafficOrderBalanceRepository,
    private readonly trafficActionsRepository: TrafficActionsRepository,
    private readonly trafficUserRepository: EntityRepository<TrafficUserEntity>,
    private readonly userBalanceRepository: UserBalanceRepository,
    private readonly userBalanceHistoryRepository: UserBalanceHistoryRepository,
    private readonly botFactoryService: BotFactoryService,
  ) {}

  /**
   * Get available targeting filters (PUBLIC - no auth required)
   */
  async getFilters(): Promise<GetFiltersResponseDto> {
    this.logger.log('Getting available filters');

    // Filters are loaded from configuration file
    // FUTURE: Move to database for dynamic management via admin panel
    return {
      genders: [...targetingFilters.genders],
      ageRanges: targetingFilters.ageRanges,
      countries: targetingFilters.countries,
      languages: targetingFilters.languages,
      actions: [
        { action: 'subscribe', displayName: 'Channel Subscribe', basePrice: 0.1 },
        { action: 'join', displayName: 'Group Join', basePrice: 0.08 },
        { action: 'view', displayName: 'Post View', basePrice: 0.05 },
        { action: 'react', displayName: 'Post React', basePrice: 0.06 },
        { action: 'comment', displayName: 'Post Comment', basePrice: 0.12 },
      ],
    };
  }

  /**
   * Get traffic source information
   * Validates API key and returns source details
   */
  async getSourceInfo(dto: GetSourceInfoRequestDto): Promise<GetSourceInfoResponseDto> {
    this.logger.log('Getting source info');

    try {
      const source = await this.validateApiKey(dto.apiKey);

      // Validate bot with Telegram if we have a token
      if (source.botToken && source.type === 'bot_with_token') {
        const validation = await this.validateBotWithTelegram(source.botToken);

        if (!validation.isValid) {
          return {
            sourceId: source.id,
            sourceType: source.type,
            isActive: false,
            error: validation.error || 'Bot validation failed',
          };
        }
      }

      return {
        sourceId: source.id,
        sourceType: source.type,
        botId: source.telegramId ? parseInt(source.telegramId, 10) : undefined,
        botUsername: source.botUsername,
        isActive: source.isActive,
      };
    } catch (err: unknown) {
      this.logger.error(`Get source info failed: ${getErrorMessage(err)}`);

      if (err instanceof UnauthorizedException) {
        throw err;
      }

      throw new BadRequestException('Failed to get source information');
    }
  }

  /**
   * Check mandatory subscription status
   * For now, returns skipCheck=true (no mandatory subscriptions yet)
   */
  async checkSubscription(dto: CheckSubscriptionRequestDto): Promise<CheckSubscriptionResponseDto> {
    this.logger.log(`Checking subscription for user ${dto.userId}`);

    try {
      // Validate API key
      await this.validateApiKey(dto.apiKey);

      // FUTURE: Implement mandatory subscription checks
      // For now, always skip check
      return {
        skipCheck: true,
        info: 'No mandatory subscriptions required',
      };
    } catch (err: unknown) {
      this.logger.error(`Check subscription failed: ${getErrorMessage(err)}`);

      if (err instanceof UnauthorizedException) {
        throw err;
      }

      return {
        skipCheck: false,
        error: 'Failed to check subscription status',
      };
    }
  }

  /**
   * Get available tasks for user
   * Filters orders by targeting requirements and excludes completed tasks
   */
  async getTasks(dto: GetTasksRequestDto): Promise<GetTasksResponseDto> {
    this.logger.log(`Getting tasks for user ${dto.userId}`);

    try {
      const source = await this.validateApiKey(dto.apiKey);

      // Get active orders for this source
      const orders = await this.trafficOrderRepository.find(
        {
          trafficSource: source.id,
          status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
          $or: [{ endDate: { $gte: new Date() } }, { endDate: null }],
        },
        {
          populate: ['trafficTarget', 'actions'],
        },
      );

      // Filter orders by targeting requirements
      const filteredOrders = orders.filter((order) => this.matchesTargeting(order, dto));

      // Get completed task IDs for this user
      const completedTaskIds = await this.getCompletedTaskIdsForUser(dto.userId, source.id);

      // Map to TaskDto and filter out completed
      const tasks: TaskDto[] = [];
      const limit = dto.limit ?? 5;

      for (const order of filteredOrders) {
        if (tasks.length >= limit) {
          break;
        }

        const taskId = this.generateTaskId(order.orderId, dto.userId.toString());

        // Skip if already completed
        if (completedTaskIds.has(taskId)) {
          continue;
        }

        const target = order.trafficTarget.getEntity();
        const remainingSlots = order.targetCount - order.currentCount;

        // Skip if no remaining slots
        if (remainingSlots <= 0) {
          continue;
        }

        tasks.push({
          taskId,
          orderId: order.orderId,
          action: order.type,
          price: toNumber(decimal(order.pricePerAction)),
          link: target.inviteLink || '',
          links: undefined,
          name: target.name,
          username: target.username,
          photo: undefined,
          description: order.description,
          remainingSlots,
        });
      }

      return {
        tasks,
        totalCount: tasks.length,
      };
    } catch (err: unknown) {
      this.logger.error(`Get tasks failed: ${getErrorMessage(err)}`);

      if (err instanceof UnauthorizedException) {
        throw err;
      }

      return {
        tasks: [],
        totalCount: 0,
        error: 'Failed to get available tasks',
      };
    }
  }

  /**
   * Check task completion status
   */
  async checkTaskStatus(dto: CheckTaskStatusRequestDto): Promise<CheckTaskStatusResponseDto> {
    this.logger.log(`Checking status for task ${dto.taskId}`);

    try {
      const source = await this.validateApiKey(dto.apiKey);

      // Parse taskId to get orderId and userId
      const { orderId, userId } = this.parseTaskId(dto.taskId);

      // Find order
      const order = await this.trafficOrderRepository.findOne(
        {
          orderId,
          trafficSource: source.id,
        },
        {
          populate: ['actions'],
        },
      );

      if (!order) {
        return {
          status: 'not_started',
          canSubmit: false,
          error: 'Task not found',
        };
      }

      // Check if action exists
      const action = await this.trafficActionsRepository.findOne({
        trafficOrder: order.id,
        actionData: {
          userId: parseInt(userId, 10),
        },
      });

      if (!action) {
        return {
          status: 'not_started',
          canSubmit: true,
        };
      }

      // Map status
      const statusMap: Record<TrafficActionStatus, string> = {
        [TrafficActionStatus.Pending]: 'pending',
        [TrafficActionStatus.InProgress]: 'pending',
        [TrafficActionStatus.Completed]: 'completed',
        [TrafficActionStatus.Failed]: 'failed',
        [TrafficActionStatus.Cancelled]: 'failed',
      };

      return {
        status: statusMap[action.status] || 'not_started',
        canSubmit: action.status !== TrafficActionStatus.Completed,
        completedAt: action.completedAt?.toISOString(),
      };
    } catch (err: unknown) {
      this.logger.error(`Check task status failed: ${getErrorMessage(err)}`);

      if (err instanceof UnauthorizedException) {
        throw err;
      }

      return {
        status: 'not_started',
        canSubmit: false,
        error: 'Failed to check task status',
      };
    }
  }

  /**
   * Complete a task and process payment
   * Refactored for better readability and maintainability
   *
   * This is the critical method that handles all balance transactions:
   * - Validates task completion prerequisites
   * - Creates action record
   * - Processes balance flow (deduct from locked, credit seller)
   * - Updates order progress and user stats
   */
  async completeTask(dto: CompleteTaskRequestDto): Promise<CompleteTaskResponseDto> {
    this.logger.log(`Completing task ${dto.taskId} for user ${dto.userId}`);

    try {
      return await this.em.transactional(async () => {
        // 1. Validate API key
        const source = await this.validateApiKey(dto.apiKey);

        // 2. Validate task completion prerequisites AND acquire pessimistic lock early
        // This prevents race conditions by locking BEFORE duplicate check
        const { order, reserve } = await this.validateTaskCompletion(dto, source);

        // 3. Find or create traffic user
        const trafficUser = await this.findOrCreateTrafficUser(dto.userId, dto.username, source.id);

        // 4. Create action record
        const action = this.createTaskAction(dto, order, source);

        // 5. Process balance flow (reserve already locked from step 2)
        const reward = decimal(order.pricePerAction);
        const rewardAmount = toDbString(reward, 8);
        await this.processBalanceFlow(order, source, rewardAmount, reserve);

        // 6. Update order progress
        this.updateOrderProgress(order, reward);

        // 7. Update traffic user stats
        this.updateTrafficUserStats(trafficUser, reward);

        // 8. Persist all changes
        await this.em.flush();

        this.logger.log(`Task completed: ${dto.taskId}, reward: ${reward.toString()}`);

        return {
          success: true,
          actionId: action.actionId,
          status: 'verified',
          reward: toNumber(reward),
          totalEarnings: toNumber(decimal(trafficUser.totalEarnings)),
        };
      });
    } catch (err: unknown) {
      this.logger.error(`Complete task failed: ${getErrorMessage(err)}`);

      if (err instanceof UnauthorizedException) {
        throw err;
      }

      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to complete task',
      };
    }
  }

  /**
   * Get user's completed tasks
   */
  async getCompletedTasks(dto: GetCompletedTasksRequestDto): Promise<GetCompletedTasksResponseDto> {
    this.logger.log(`Getting completed tasks for user ${dto.userId}`);

    try {
      const source = await this.validateApiKey(dto.apiKey);

      // Find traffic user
      const trafficUser = await this.trafficUserRepository.findOne({
        telegramId: dto.userId.toString(),
        trafficSource: source.id,
      });

      if (!trafficUser) {
        return {
          completedTasks: [],
          totalCount: 0,
        };
      }

      // Find completed actions
      const actions = await this.trafficActionsRepository.find(
        {
          trafficSource: source.id,
          status: TrafficActionStatus.Completed,
          actionData: {
            userId: dto.userId,
          },
        },
        {
          populate: ['trafficOrder'],
          orderBy: { completedAt: 'DESC' },
        },
      );

      const completedTasks: CompletedTaskDto[] = actions.map((action) => {
        const order = action.trafficOrder?.getEntity();

        return {
          taskId: this.generateTaskId(order?.orderId || '', dto.userId.toString()),
          orderId: order?.orderId || '',
          reward: toNumber(decimal(action.reward)),
          completedAt: action.completedAt?.toISOString() || '',
        };
      });

      return {
        completedTasks,
        totalCount: completedTasks.length,
      };
    } catch (err: unknown) {
      this.logger.error(`Get completed tasks failed: ${getErrorMessage(err)}`);

      if (err instanceof UnauthorizedException) {
        throw err;
      }

      return {
        completedTasks: [],
        totalCount: 0,
        error: 'Failed to get completed tasks',
      };
    }
  }

  // =====================================
  // PRIVATE HELPER METHODS
  // =====================================

  /**
   * Validate API key using bcrypt hash comparison
   * Securely validates the provided API key against stored hash
   */
  private async validateApiKey(apiKey: string): Promise<TrafficSourceEntity> {
    const source = await this.trafficSourceRepository.findByApiKey(apiKey);

    if (!source) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!source.isActive) {
      throw new UnauthorizedException('API key belongs to inactive source');
    }

    // Populate managedBy relation if needed
    if (source.managedBy && !source.managedBy.isInitialized()) {
      await this.em.populate(source, ['managedBy']);
    }

    return source;
  }

  /**
   * Validate bot with Telegram API using BotFactoryService
   * Uses shared bot utilities from @app/feature-bot-shared
   */
  private async validateBotWithTelegram(
    token: string,
  ): Promise<{ isValid: boolean; botId?: number; username?: string; error?: string }> {
    try {
      const validationResult = await this.botFactoryService.validateBotToken(token);

      if (!validationResult.isValid) {
        return {
          isValid: false,
          error: validationResult.error || 'Invalid bot token',
        };
      }

      return {
        isValid: true,
        botId: validationResult.botInfo?.id,
        username: validationResult.botInfo?.username,
      };
    } catch (err: unknown) {
      this.logger.error(`Telegram validation failed: ${getErrorMessage(err)}`);

      return {
        isValid: false,
        error: 'Failed to validate bot with Telegram',
      };
    }
  }

  /**
   * Check if order matches targeting requirements
   */
  private matchesTargeting(order: TrafficOrderEntity, dto: GetTasksRequestDto): boolean {
    const { requirements } = order;

    if (!requirements) {
      return true; // No targeting requirements
    }

    return (
      this.matchesGender(requirements, dto) &&
      this.matchesAge(requirements, dto) &&
      this.matchesCountry(requirements, dto) &&
      this.matchesLanguage(requirements, dto)
    );
  }

  private matchesGender(requirements: Record<string, unknown>, dto: { gender?: string }): boolean {
    // eslint-disable-next-line prefer-destructuring
    const gender = requirements['gender'];
    if (!gender || !dto.gender) {
      return true;
    }

    return gender === dto.gender;
  }

  private matchesAge(requirements: Record<string, unknown>, dto: { age?: number }): boolean {
    const ageMin = requirements['ageMin'] as number | undefined;
    const ageMax = requirements['ageMax'] as number | undefined;
    if (dto.age === undefined) {
      return true;
    }

    if (ageMin !== undefined && dto.age < ageMin) {
      return false;
    }

    if (ageMax !== undefined && dto.age > ageMax) {
      return false;
    }

    return true;
  }

  private matchesCountry(requirements: Record<string, unknown>, dto: { country?: string }): boolean {
    if (!requirements['countries'] || !dto.country) {
      return true;
    }

    const countries = Array.isArray(requirements['countries'])
      ? (requirements['countries'] as string[])
      : [requirements['countries'] as string];

    return countries.includes(dto.country);
  }

  private matchesLanguage(requirements: Record<string, unknown>, dto: { languageCode?: string }): boolean {
    if (!requirements['languages'] || !dto.languageCode) {
      return true;
    }

    const languages = Array.isArray(requirements['languages'])
      ? (requirements['languages'] as string[])
      : [requirements['languages'] as string];

    return languages.includes(dto.languageCode);
  }

  /**
   * Get completed task IDs for user
   */
  private async getCompletedTaskIdsForUser(userId: number, sourceId: string): Promise<Set<string>> {
    const actions = await this.trafficActionsRepository.find(
      {
        trafficSource: sourceId,
        status: TrafficActionStatus.Completed,
        actionData: {
          userId,
        },
      },
      {
        populate: ['trafficOrder'],
      },
    );

    return new Set(
      actions.map((action) => {
        const order = action.trafficOrder?.getEntity();

        return this.generateTaskId(order?.orderId || '', userId.toString());
      }),
    );
  }

  /**
   * Find or create traffic user
   */
  private async findOrCreateTrafficUser(
    telegramId: number,
    username: string | undefined,
    sourceId: string,
  ): Promise<TrafficUserEntity> {
    let trafficUser = await this.trafficUserRepository.findOne({
      telegramId: telegramId.toString(),
      trafficSource: sourceId,
    });

    if (!trafficUser) {
      trafficUser = new TrafficUserEntity({
        telegramId: telegramId.toString(),
        username,
        firstName: username || 'User',
        trafficSourceId: sourceId,
      });

      this.em.persist(trafficUser);
    }

    return trafficUser;
  }

  /**
   * Credit balance to user (USDT)
   */
  private async creditBalance(userId: string, amount: string, referenceId: string, description: string): Promise<void> {
    // Get or create balance
    let balance = await this.userBalanceRepository.findByUserAndCurrency(userId, CurrencyCode.Usdt);

    if (!balance) {
      balance = await this.userBalanceRepository.createOrUpdateBalance(userId, CurrencyCode.Usdt, '0');
    }

    const balanceBefore = balance.balance;
    const newBalance = toDbString(add(balanceBefore, amount), 8);

    // Update balance
    balance.balance = newBalance;

    // Create history record
    await this.userBalanceHistoryRepository.createTransaction({
      userId,
      currency: CurrencyCode.Usdt,
      type: TransactionType.Reward,
      amount,
      balanceBefore,
      balanceAfter: newBalance,
      description,
      referenceId,
      status: TransactionStatus.Completed,
    });
  }

  /**
   * Validate task completion prerequisites
   * Checks order exists, is active, and not already completed
   * ACQUIRES PESSIMISTIC LOCK EARLY to prevent race conditions
   *
   * Lock acquisition order (critical for preventing deadlocks):
   * 1. Get order balance reserve
   * 2. Acquire pessimistic lock on reserve
   * 3. Check for duplicate actions (under lock protection)
   */
  private async validateTaskCompletion(
    dto: CompleteTaskRequestDto,
    source: TrafficSourceEntity,
  ): Promise<{ order: TrafficOrderEntity; reserve: TrafficOrderBalanceEntity; existsAlready: boolean }> {
    const { orderId } = this.parseTaskId(dto.taskId);

    const order = await this.trafficOrderRepository.findOne(
      {
        orderId,
        trafficSource: source.id,
      },
      {
        populate: ['creator', 'trafficSource', 'trafficTarget'],
      },
    );

    if (!order) {
      throw new BadRequestException('Task not found');
    }

    if (order.status !== TrafficOrderStatus.Active && order.status !== TrafficOrderStatus.InProgress) {
      throw new BadRequestException('Task is not active');
    }

    // CRITICAL: Acquire pessimistic lock BEFORE checking duplicates
    // This prevents race condition where two requests pass duplicate check simultaneously
    const reserve = await this.trafficOrderBalanceRepository.findByOrder(order);
    if (!reserve) {
      this.logger.error(`Order balance reserve not found for order ${order.orderId}`);
      throw new BadRequestException('Order balance reserve not found - order may not have been funded');
    }

    // Lock the reserve row for update (prevents concurrent task completions)
    this.logger.debug(`Acquiring pessimistic lock on reserve ${reserve.id} (early, before duplicate check)`);
    await this.em.lock(reserve, LockMode.PESSIMISTIC_WRITE);

    // NOW check for duplicates (protected by pessimistic lock)
    const existingAction = await this.trafficActionsRepository.findOne({
      trafficOrder: order.id,
      actionData: {
        userId: dto.userId,
      },
    });

    if (existingAction && existingAction.status === TrafficActionStatus.Completed) {
      throw new BadRequestException('Task already completed');
    }

    return { order, reserve, existsAlready: false };
  }

  /**
   * Create traffic action record
   */
  private createTaskAction(
    dto: CompleteTaskRequestDto,
    order: TrafficOrderEntity,
    source: TrafficSourceEntity,
  ): TrafficActionsEntity {
    const actionId = `ACT-${Date.now()}-${dto.userId}`;

    const action = new TrafficActionsEntity({
      actionId,
      type: _orderTypeToActionType[order.type],
      status: TrafficActionStatus.Completed,
      reward: order.pricePerAction,
      completedAt: dto.completedAt ? new Date(dto.completedAt) : new Date(),
      trafficOrderId: order.id,
      trafficSourceId: source.id,
      actionData: {
        userId: dto.userId,
        username: dto.username,
        proof: dto.proof,
      },
    });

    this.em.persist(action);

    return action;
  }

  /**
   * Process balance flow: deduct from locked balance and credit seller
   * Reserve is already locked by validateTaskCompletion (prevents race conditions)
   *
   * @param order - Traffic order
   * @param source - Traffic source (contains seller info)
   * @param rewardAmount - Amount to pay seller (string for Decimal precision)
   * @param reserve - Already locked balance reserve (locked in validateTaskCompletion)
   */
  private async processBalanceFlow(
    order: TrafficOrderEntity,
    source: TrafficSourceEntity,
    rewardAmount: string,
    reserve: TrafficOrderBalanceEntity,
  ): Promise<void> {
    const sellerUserId = source.managedBy?.getEntity().id;

    if (!sellerUserId) {
      this.logger.error(`Traffic source ${source.id} has no manager - cannot process payment`);
      throw new BadRequestException('Traffic source has no manager');
    }

    // Reserve is already pessimistically locked from validateTaskCompletion
    // No need to lock again - just validate sufficient funds

    // Check if reserve has sufficient funds
    const availableAmount = decimal(reserve.availableAmount);
    const reward = decimal(rewardAmount);

    if (availableAmount.lessThan(reward)) {
      this.logger.warn(
        `Insufficient locked balance for order ${order.orderId}: ` +
          `available ${reserve.availableAmount}, required ${rewardAmount}`,
      );

      throw new BadRequestException('Insufficient locked balance for this order');
    }

    // Deduct from locked balance
    try {
      this.logger.debug(`Deducting ${rewardAmount} from reserve ${reserve.id}`);
      await this.trafficOrderBalanceRepository.deductFromLocked(reserve.id, rewardAmount);
    } catch (err: unknown) {
      this.logger.error(`Failed to deduct from locked balance: ${getErrorMessage(err)}`);
      throw new BadRequestException('Failed to deduct from locked balance');
    }

    // Credit to seller's UserBalance
    try {
      this.logger.debug(`Crediting ${rewardAmount} to seller ${sellerUserId}`);
      await this.creditBalance(sellerUserId, rewardAmount, order.orderId, 'Traffic order seller payment');
    } catch (err: unknown) {
      this.logger.error(`Failed to credit seller balance: ${getErrorMessage(err)}`);
      // Transaction will rollback automatically, restoring the deducted amount
      throw new BadRequestException('Failed to credit seller balance');
    }
  }

  /**
   * Update order progress counters and status
   */
  private updateOrderProgress(order: TrafficOrderEntity, reward: Decimal): void {
    const currentCount = order.currentCount + 1;
    const spentAmount = toDbString(add(order.spentAmount, reward), 8);

    Object.assign(order, {
      currentCount,
      spentAmount,
      status: currentCount >= order.targetCount ? TrafficOrderStatus.Completed : TrafficOrderStatus.InProgress,
      completedAt: currentCount >= order.targetCount ? new Date() : order.completedAt,
    });
  }

  /**
   * Update traffic user statistics
   */
  private updateTrafficUserStats(trafficUser: TrafficUserEntity, reward: Decimal): void {
    Object.assign(trafficUser, {
      totalOrdersParticipated: trafficUser.totalOrdersParticipated + 1,
      totalEarnings: toDbString(add(trafficUser.totalEarnings, reward), 8),
      lastSeenAt: new Date(),
    });
  }

  /**
   * Generate task ID from orderId and userId
   */
  private generateTaskId(orderId: string, userId: string): string {
    return `${orderId}-USER-${userId}`;
  }

  /**
   * Parse task ID to get orderId and userId
   */
  private parseTaskId(taskId: string): { orderId: string; userId: string } {
    const parts = taskId.split('-USER-');

    if (parts.length !== 2) {
      throw new BadRequestException('Invalid task ID format');
    }

    return {
      orderId: parts[0] || '',
      userId: parts[1] || '',
    };
  }
}
