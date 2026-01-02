import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { decimal, getErrorMessage, toNumber } from '@app/common-shared';
import {
  CheckTaskStatusRequestDto,
  CheckTaskStatusResponseDto,
  GetTasksRequestDto,
  GetTasksResponseDto,
  TaskDto,
} from '@app/feature-traffic-shared';
import {
  TrafficActionsEntity,
  TrafficActionStatus,
  TrafficOrderEntity,
  TrafficOrderSourceEntity,
  TrafficOrderStatus,
  TrafficSourceEntity,
  TrafficSourceRepository,
  TrafficSourceStatus,
} from '@app/database';

/**
 * Service for Public Traffic Source API
 * Provides endpoints: getTasks, checkTaskStatus
 * All methods validate API key via header
 *
 * MONEY FLOW:
 * 1. Order creator pre-pays total budget (targetCount * pricePerAction)
 * 2. User performs action (join channel, etc.) - detected by bot
 * 3. Bot creates action with status=completed, updates order counts
 * 4. Source calls /check endpoint to get completion status and reward
 * 5. Source rewards user with the amount returned
 */
@Injectable()
export class SourcePublicApiService {
  private readonly logger = new Logger(SourcePublicApiService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly trafficSourceRepository: TrafficSourceRepository,
  ) {}

  /**
   * Get available tasks for user
   * Optimized with database-level filtering where possible
   * Uses transaction for consistent reads
   */
  async getTasks(apiKey: string, dto: GetTasksRequestDto): Promise<GetTasksResponseDto> {
    this.logger.log(`Getting tasks for user ${dto.userId}`);

    const em = this.em.fork();

    try {
      const source = await this.validateApiKey(apiKey, em);

      return await em.transactional(async (txEm) => {
        const limit = dto.limit ?? 5;

        const orderSources = await this.fetchActiveOrderSources(txEm, source.id);
        const sourceCategoryTypes = this.getSourceCategoryTypes(source);
        const submittedTaskIds = await this.getSubmittedTaskIds(txEm, source.id, dto.userId);

        const tasks = this.filterAndMapToTasks(orderSources, dto, sourceCategoryTypes, submittedTaskIds, limit);

        return {
          tasks,
          totalCount: tasks.length,
        };
      });
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
   * Check task completion status and get reward
   * Returns the reward amount when task is completed
   * Transaction-safe for consistent reads
   */
  async checkTaskStatus(apiKey: string, dto: CheckTaskStatusRequestDto): Promise<CheckTaskStatusResponseDto> {
    this.logger.log(`Checking status for task ${dto.taskId}`);

    const em = this.em.fork();

    try {
      const source = await this.validateApiKey(apiKey, em);
      const { orderId, userId } = this.parseTaskId(dto.taskId);
      const userIdNum = parseInt(userId, 10);

      if (isNaN(userIdNum)) {
        return {
          status: 'failed',
          error: 'Invalid user ID in task',
        };
      }

      return await em.transactional(async (txEm) => {
        const orderSource = await txEm.findOne(
          TrafficOrderSourceEntity,
          { trafficSource: source.id, trafficOrder: { orderId } },
          { populate: ['trafficOrder'] },
        );

        const order = orderSource?.trafficOrder?.getEntity();

        if (!order) {
          return {
            status: 'not_started',
            error: 'Task not found',
          };
        }

        const action = await txEm.findOne(TrafficActionsEntity, {
          trafficOrder: order.id,
          trafficSource: source.id,
          actionData: { userId: userIdNum },
        });

        if (!action) {
          return { status: 'not_started' };
        }

        return this.mapActionToResponse(action, order);
      });
    } catch (err: unknown) {
      this.logger.error(`Check task status failed: ${getErrorMessage(err)}`);

      if (err instanceof UnauthorizedException) {
        throw err;
      }

      return {
        status: 'failed',
        error: 'Failed to check task status',
      };
    }
  }

  // =====================================
  // PRIVATE HELPER METHODS - DATA FETCHING
  // =====================================

  private async fetchActiveOrderSources(txEm: EntityManager, sourceId: string): Promise<TrafficOrderSourceEntity[]> {
    const now = new Date();

    return txEm.find(
      TrafficOrderSourceEntity,
      {
        trafficSource: sourceId,
        trafficOrder: {
          status: TrafficOrderStatus.Active,
          $or: [{ endDate: null }, { endDate: { $gte: now } }],
        },
      },
      {
        populate: ['trafficOrder', 'trafficOrder.orderTargets', 'trafficOrder.orderTargets.trafficTarget'],
        orderBy: { trafficOrder: { createdAt: 'DESC' } },
      },
    );
  }

  private async getSubmittedTaskIds(txEm: EntityManager, sourceId: string, userId: number): Promise<Set<string>> {
    const existingActions = await txEm.find(
      TrafficActionsEntity,
      {
        trafficSource: sourceId,
        status: {
          $in: [TrafficActionStatus.Completed, TrafficActionStatus.Pending, TrafficActionStatus.InProgress],
        },
      },
      { fields: ['trafficOrder', 'actionData'] },
    );

    const submittedTaskIds = new Set<string>();

    for (const action of existingActions) {
      const { actionData } = action;
      if (actionData && typeof actionData === 'object' && 'userId' in actionData) {
        const actionUserId = actionData['userId'];
        if (typeof actionUserId === 'number' && actionUserId === userId) {
          const orderId = action.trafficOrder?.id;
          if (orderId) {
            submittedTaskIds.add(`${orderId}-${userId}`);
          }
        }
      }
    }

    return submittedTaskIds;
  }

  // =====================================
  // PRIVATE HELPER METHODS - MAPPING
  // =====================================

  private filterAndMapToTasks(
    orderSources: TrafficOrderSourceEntity[],
    dto: GetTasksRequestDto,
    sourceCategoryTypes: string[],
    submittedTaskIds: Set<string>,
    limit: number,
  ): TaskDto[] {
    const tasks: TaskDto[] = [];

    for (const orderSource of orderSources) {
      if (tasks.length >= limit) {
        break;
      }

      const task = this.tryMapOrderToTask(orderSource, dto, sourceCategoryTypes, submittedTaskIds);
      if (task) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  private tryMapOrderToTask(
    orderSource: TrafficOrderSourceEntity,
    dto: GetTasksRequestDto,
    sourceCategoryTypes: string[],
    submittedTaskIds: Set<string>,
  ): TaskDto | null {
    const order = orderSource.trafficOrder.getEntity();

    const remainingSlots = order.targetCount - order.currentCount;
    if (remainingSlots <= 0) {
      return null;
    }

    if (submittedTaskIds.has(`${order.id}-${dto.userId}`)) {
      return null;
    }

    if (!this.matchesTargeting(order, dto, sourceCategoryTypes)) {
      return null;
    }

    const target = this.getPrimaryTarget(order);
    if (!target) {
      return null;
    }

    return {
      taskId: this.generateTaskId(order.orderId, dto.userId.toString()),
      orderId: order.orderId,
      action: order.type,
      price: toNumber(decimal(order.pricePerAction)),
      link: target.inviteLink || `https://t.me/${target.username?.replace('@', '') || ''}`,
      links: undefined,
      name: target.name,
      username: target.username,
      photo: undefined,
      description: order.description,
      remainingSlots,
    };
  }

  private getPrimaryTarget(
    order: TrafficOrderEntity,
  ): { inviteLink?: string; username?: string; name?: string } | null {
    const orderTargets = order.orderTargets?.getItems() ?? [];
    const primaryOrderTarget = orderTargets.find((ot) => ot.isPrimary) ?? orderTargets[0];

    return primaryOrderTarget?.trafficTarget?.getEntity() ?? null;
  }

  private mapActionToResponse(action: TrafficActionsEntity, order: TrafficOrderEntity): CheckTaskStatusResponseDto {
    const statusMap: Record<TrafficActionStatus, string> = {
      [TrafficActionStatus.Pending]: 'pending',
      [TrafficActionStatus.InProgress]: 'pending',
      [TrafficActionStatus.Completed]: 'completed',
      [TrafficActionStatus.Failed]: 'failed',
      [TrafficActionStatus.Cancelled]: 'failed',
    };

    const status = statusMap[action.status] || 'not_started';
    const isCompleted = action.status === TrafficActionStatus.Completed;

    return {
      status,
      reward: isCompleted ? toNumber(decimal(action.reward || order.pricePerAction)) : undefined,
      completedAt: action.completedAt?.toISOString(),
    };
  }

  // =====================================
  // PRIVATE HELPER METHODS - VALIDATION
  // =====================================

  private async validateApiKey(apiKey: string, em: EntityManager): Promise<TrafficSourceEntity> {
    const source = await this.trafficSourceRepository.findByApiKey(apiKey);

    if (!source) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (source.status !== TrafficSourceStatus.Active) {
      throw new UnauthorizedException('API key belongs to inactive source');
    }

    await em.populate(source, ['categories', 'categories.category']);

    return source;
  }

  private getSourceCategoryTypes(source: TrafficSourceEntity): string[] {
    const categories = source.categories?.getItems() ?? [];
    const result: string[] = [];

    for (const cat of categories) {
      const categoryType = cat.category?.getEntity()?.categoryType;
      if (categoryType !== undefined) {
        result.push(String(categoryType));
      }
    }

    return result;
  }

  // =====================================
  // PRIVATE HELPER METHODS - TARGETING
  // =====================================

  private matchesTargeting(order: TrafficOrderEntity, dto: GetTasksRequestDto, sourceCategoryTypes: string[]): boolean {
    const { requirements } = order;

    if (!requirements) {
      return true;
    }

    return (
      this.matchesGender(requirements, dto) &&
      this.matchesAge(requirements, dto) &&
      this.matchesCountry(requirements, dto) &&
      this.matchesRegion(requirements, dto) &&
      this.matchesCity(requirements, dto) &&
      this.matchesLanguage(requirements, dto) &&
      this.matchesCategories(requirements, sourceCategoryTypes)
    );
  }

  private matchesCategories(requirements: Record<string, unknown>, sourceCategoryTypes: string[]): boolean {
    const { allowedCategories } = requirements;

    if (!Array.isArray(allowedCategories) || allowedCategories.length === 0) {
      return true;
    }

    return sourceCategoryTypes.some((sourceCategory) =>
      allowedCategories.some((cat) => typeof cat === 'string' && cat === sourceCategory),
    );
  }

  private matchesGender(requirements: Record<string, unknown>, dto: GetTasksRequestDto): boolean {
    const { gender } = requirements;

    if (!gender || gender === 'any' || !dto.gender) {
      return true;
    }

    return gender === dto.gender;
  }

  private matchesAge(requirements: Record<string, unknown>, dto: GetTasksRequestDto): boolean {
    const { minAge, maxAge } = requirements;
    if (dto.age === undefined) {
      return true;
    }

    if (typeof minAge === 'number' && dto.age < minAge) {
      return false;
    }

    if (typeof maxAge === 'number' && dto.age > maxAge) {
      return false;
    }

    return true;
  }

  private matchesCountry(requirements: Record<string, unknown>, dto: GetTasksRequestDto): boolean {
    const { countries } = requirements;
    if (!countries || !dto.country) {
      return true;
    }

    if (Array.isArray(countries)) {
      return countries.some((c) => typeof c === 'string' && c.toLowerCase() === dto.country?.toLowerCase());
    }

    return typeof countries === 'string' && countries.toLowerCase() === dto.country.toLowerCase();
  }

  private matchesRegion(requirements: Record<string, unknown>, dto: GetTasksRequestDto): boolean {
    const { regions } = requirements;
    if (!regions || !dto.region) {
      return true;
    }

    if (Array.isArray(regions)) {
      return regions.some((r) => typeof r === 'string' && r.toLowerCase() === dto.region?.toLowerCase());
    }

    return typeof regions === 'string' && regions.toLowerCase() === dto.region.toLowerCase();
  }

  private matchesCity(requirements: Record<string, unknown>, dto: GetTasksRequestDto): boolean {
    const { cities } = requirements;
    if (!cities || !dto.city) {
      return true;
    }

    if (Array.isArray(cities)) {
      return cities.some((c) => typeof c === 'string' && c.toLowerCase() === dto.city?.toLowerCase());
    }

    return typeof cities === 'string' && cities.toLowerCase() === dto.city.toLowerCase();
  }

  private matchesLanguage(requirements: Record<string, unknown>, dto: GetTasksRequestDto): boolean {
    const { languages } = requirements;

    if (!languages || !dto.language) {
      return true;
    }

    if (Array.isArray(languages)) {
      return languages.some((l) => typeof l === 'string' && l.toLowerCase() === dto.language?.toLowerCase());
    }

    return typeof languages === 'string' && languages.toLowerCase() === dto.language.toLowerCase();
  }

  // =====================================
  // PRIVATE HELPER METHODS - TASK ID
  // =====================================

  private generateTaskId(orderId: string, userId: string): string {
    return `${orderId}-USER-${userId}`;
  }

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
