import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { getErrorMessage, add, subtract, toDbString, decimal, toNumber } from '@app/common-shared';
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
  TrafficActionsEntity,
  TrafficActionsRepository,
  TrafficOrderEntity,
  TrafficOrderRepository,
  TrafficOrderStatus,
  TrafficSourceEntity,
  TrafficSourceRepository,
  TrafficUserEntity,
  TransactionStatus,
  TransactionType,
  UserBalanceHistoryRepository,
  UserBalanceRepository,
} from '@app/database';

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
    private readonly trafficActionsRepository: TrafficActionsRepository,
    private readonly trafficUserRepository: EntityRepository<TrafficUserEntity>,
    private readonly userBalanceRepository: UserBalanceRepository,
    private readonly userBalanceHistoryRepository: UserBalanceHistoryRepository,
  ) {}

  /**
   * Get available targeting filters (PUBLIC - no auth required)
   */
  async getFilters(): Promise<GetFiltersResponseDto> {
    this.logger.log('Getting available filters');

    // Return hardcoded filter options
    // TODO: Make these configurable from database/config
    return {
      genders: ['male', 'female'],
      ageRanges: [
        { label: '13-17', min: 13, max: 17 },
        { label: '18-24', min: 18, max: 24 },
        { label: '25-34', min: 25, max: 34 },
        { label: '35-44', min: 35, max: 44 },
        { label: '45-54', min: 45, max: 54 },
        { label: '55+', min: 55, max: 100 },
      ],
      countries: [
        { code: 'US', name: 'United States' },
        { code: 'GB', name: 'United Kingdom' },
        { code: 'CA', name: 'Canada' },
        { code: 'AU', name: 'Australia' },
        { code: 'DE', name: 'Germany' },
        { code: 'FR', name: 'France' },
        { code: 'RU', name: 'Russia' },
        { code: 'UA', name: 'Ukraine' },
        { code: 'BR', name: 'Brazil' },
        { code: 'IN', name: 'India' },
      ],
      languages: [
        { code: 'en', name: 'English' },
        { code: 'ru', name: 'Russian' },
        { code: 'uk', name: 'Ukrainian' },
        { code: 'es', name: 'Spanish' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'de', name: 'German' },
        { code: 'fr', name: 'French' },
        { code: 'it', name: 'Italian' },
      ],
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

      // TODO: Implement mandatory subscription checks
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

        const taskId = this.generateTaskId(order.orderId, dto.userId);

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
          link: target.targetUrl || '',
          links: target.additionalUrls,
          name: target.name,
          username: target.username,
          photo: target.photoUrl,
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
   * Complete task with BALANCE FLOW
   * This is the critical method that handles all balance transactions
   */
  async completeTask(dto: CompleteTaskRequestDto): Promise<CompleteTaskResponseDto> {
    this.logger.log(`Completing task ${dto.taskId} for user ${dto.userId}`);

    try {
      return await this.em.transactional(async () => {
        // 1. Validate API key
        const source = await this.validateApiKey(dto.apiKey);

        // 2. Parse taskId
        const { orderId } = this.parseTaskId(dto.taskId);

        // 3. Find order
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
          return {
            success: false,
            error: 'Task not found',
          };
        }

        // 4. Check if order is active
        if (order.status !== TrafficOrderStatus.Active && order.status !== TrafficOrderStatus.InProgress) {
          return {
            success: false,
            error: 'Task is not active',
          };
        }

        // 5. Check if already completed
        const existingAction = await this.trafficActionsRepository.findOne({
          trafficOrder: order.id,
          actionData: {
            userId: dto.userId,
          },
        });

        if (existingAction && existingAction.status === TrafficActionStatus.Completed) {
          return {
            success: false,
            error: 'Task already completed',
          };
        }

        // 6. Find or create traffic user
        const trafficUser = await this.findOrCreateTrafficUser(dto.userId, dto.username, source.id);

        // 7. Create action
        const actionId = `ACT-${Date.now()}-${dto.userId}`;
        const action = new TrafficActionsEntity({
          actionId,
          type: order.type,
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

        // 8. BALANCE FLOW
        const reward = decimal(order.pricePerAction);
        const buyerUserId = order.creator.getEntity().id;
        const sellerUserId = source.managedBy?.getEntity().id;

        if (!sellerUserId) {
          throw new BadRequestException('Traffic source has no manager');
        }

        // Simple flow: Buyer pays full amount to seller
        // Seller is responsible for distributing rewards to their bot users
        // We just track user earnings in TrafficUser.totalEarnings
        const rewardAmount = toDbString(reward, 8);

        // Deduct from buyer
        await this.debitBalance(buyerUserId, rewardAmount, order.orderId, 'Traffic order payment');

        // Credit to seller (full amount - seller distributes to bot users separately)
        await this.creditBalance(sellerUserId, rewardAmount, order.orderId, 'Traffic order seller payment');

        // 9. Update order progress
        order.currentCount += 1;
        order.spentAmount = toDbString(add(order.spentAmount, reward), 8);

        if (order.currentCount >= order.targetCount) {
          order.status = TrafficOrderStatus.Completed;
          order.completedAt = new Date();
        } else {
          order.status = TrafficOrderStatus.InProgress;
        }

        // 10. Update traffic user stats
        // Track reward in user's total earnings (seller will pay them separately)
        trafficUser.totalOrdersParticipated += 1;
        trafficUser.totalEarnings = toDbString(add(trafficUser.totalEarnings, reward), 8);
        trafficUser.lastSeenAt = new Date();

        await this.em.flush();

        this.logger.log(`Task completed: ${dto.taskId}, reward: ${reward.toString()}`);

        return {
          success: true,
          actionId,
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
   * Validate API key and return source entity
   * TODO: Use dedicated apiKey field instead of botToken
   */
  private async validateApiKey(apiKey: string): Promise<TrafficSourceEntity> {
    // Currently using botToken as API key (temporary)
    const source = await this.trafficSourceRepository.findOne({ botToken: apiKey }, { populate: ['managedBy'] });

    if (!source || !source.isActive) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    return source;
  }

  /**
   * Validate bot with Telegram API
   * Real implementation - calls actual Telegram API
   */
  private async validateBotWithTelegram(
    token: string,
  ): Promise<{ isValid: boolean; botId?: number; username?: string; error?: string }> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = (await response.json()) as {
        ok: boolean;
        result?: { id: number; username: string };
        description?: string;
      };

      if (!data.ok) {
        return {
          isValid: false,
          error: data.description || 'Invalid bot token',
        };
      }

      return {
        isValid: true,
        botId: data.result?.id,
        username: data.result?.username,
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

  private matchesGender(requirements: { gender?: string }, dto: { gender?: string }): boolean {
    if (!requirements.gender || !dto.gender) {
      return true;
    }

    return requirements.gender === dto.gender;
  }

  private matchesAge(requirements: { ageMin?: number; ageMax?: number }, dto: { age?: number }): boolean {
    if (dto.age === undefined) {
      return true;
    }

    if (requirements.ageMin !== undefined && dto.age < requirements.ageMin) {
      return false;
    }

    if (requirements.ageMax !== undefined && dto.age > requirements.ageMax) {
      return false;
    }

    return true;
  }

  private matchesCountry(requirements: { countries?: string | string[] }, dto: { country?: string }): boolean {
    if (!requirements.countries || !dto.country) {
      return true;
    }

    const countries = Array.isArray(requirements.countries) ? requirements.countries : [requirements.countries];

    return countries.includes(dto.country);
  }

  private matchesLanguage(requirements: { languages?: string | string[] }, dto: { languageCode?: string }): boolean {
    if (!requirements.languages || !dto.languageCode) {
      return true;
    }

    const languages = Array.isArray(requirements.languages) ? requirements.languages : [requirements.languages];

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
   * Debit balance from user
   */
  private async debitBalance(userId: string, amount: string, referenceId: string, description: string): Promise<void> {
    // Get or create balance
    let balance = await this.userBalanceRepository.findByUserAndCurrency(userId, CurrencyCode.STARS);

    if (!balance) {
      balance = await this.userBalanceRepository.createOrUpdateBalance(userId, CurrencyCode.STARS, '0');
    }

    const balanceBefore = balance.balance;
    const newBalance = toDbString(subtract(balanceBefore, amount), 8);

    // Check sufficient balance
    if (decimal(newBalance).lessThan('0')) {
      throw new BadRequestException('Insufficient balance');
    }

    // Update balance
    balance.balance = newBalance;

    // Create history record
    await this.userBalanceHistoryRepository.createTransaction({
      userId,
      currency: CurrencyCode.STARS,
      type: TransactionType.Reward,
      amount: `-${amount}`,
      balanceBefore,
      balanceAfter: newBalance,
      description,
      referenceId,
      status: TransactionStatus.Completed,
    });
  }

  /**
   * Credit balance to user
   */
  private async creditBalance(userId: string, amount: string, referenceId: string, description: string): Promise<void> {
    // Get or create balance
    let balance = await this.userBalanceRepository.findByUserAndCurrency(userId, CurrencyCode.STARS);

    if (!balance) {
      balance = await this.userBalanceRepository.createOrUpdateBalance(userId, CurrencyCode.STARS, '0');
    }

    const balanceBefore = balance.balance;
    const newBalance = toDbString(add(balanceBefore, amount), 8);

    // Update balance
    balance.balance = newBalance;

    // Create history record
    await this.userBalanceHistoryRepository.createTransaction({
      userId,
      currency: CurrencyCode.STARS,
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
