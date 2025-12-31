import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { getErrorMessage, decimal, toNumber } from '@app/common-shared';
import {
  CheckTaskStatusRequestDto,
  CheckTaskStatusResponseDto,
  GetTasksRequestDto,
  GetTasksResponseDto,
  TaskDto,
} from '@app/feature-traffic-shared';
import {
  TrafficActionStatus,
  TrafficActionsRepository,
  TrafficOrderEntity,
  TrafficOrderRepository,
  TrafficOrderSourceEntity,
  TrafficOrderStatus,
  TrafficSourceEntity,
  TrafficSourceRepository,
  TrafficSourceStatus,
  TrafficUserEntity,
} from '@app/database';

/**
 * Service for Public Traffic Source API
 * Minimal API: getTasks and checkTaskStatus only
 * All methods validate API key via header
 */
@Injectable()
export class SourcePublicApiService {
  private readonly logger = new Logger(SourcePublicApiService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly trafficSourceRepository: TrafficSourceRepository,
    private readonly trafficOrderRepository: TrafficOrderRepository,
    private readonly trafficActionsRepository: TrafficActionsRepository,
    @InjectRepository(TrafficUserEntity)
    private readonly trafficUserRepository: EntityRepository<TrafficUserEntity>,
    @InjectRepository(TrafficOrderSourceEntity)
    private readonly trafficOrderSourceRepository: EntityRepository<TrafficOrderSourceEntity>,
  ) {}

  /**
   * Get available tasks for user
   * Filters orders by all targeting requirements
   */
  async getTasks(apiKey: string, dto: GetTasksRequestDto): Promise<GetTasksResponseDto> {
    this.logger.log(`Getting tasks for user ${dto.userId}`);

    try {
      const source = await this.validateApiKey(apiKey);

      // Get active orders for this source via junction table
      const orderSources = await this.trafficOrderSourceRepository.find(
        { trafficSource: source.id },
        { populate: ['trafficOrder', 'trafficOrder.orderTargets', 'trafficOrder.orderTargets.trafficTarget'] },
      );

      // Filter to active orders with valid date range
      const now = new Date();
      const orders = orderSources
        .map((os) => os.trafficOrder.getEntity())
        .filter((order) => {
          const isActive = order.status === TrafficOrderStatus.Active;
          const isValidDate = !order.endDate || order.endDate >= now;

          return isActive && isValidDate;
        });

      // Get source category types for filtering
      const sourceCategoryTypes = this.getSourceCategoryTypes(source);

      // Filter orders by all targeting requirements
      const filteredOrders = orders.filter((order) => this.matchesTargeting(order, dto, sourceCategoryTypes));

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

        // Get primary target from junction table
        const orderTargets = order.orderTargets?.getItems() ?? [];
        const primaryOrderTarget = orderTargets.find((ot) => ot.isPrimary) ?? orderTargets[0];
        const target = primaryOrderTarget?.trafficTarget?.getEntity();

        if (!target) {
          continue;
        }

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
  async checkTaskStatus(apiKey: string, dto: CheckTaskStatusRequestDto): Promise<CheckTaskStatusResponseDto> {
    this.logger.log(`Checking status for task ${dto.taskId}`);

    try {
      const source = await this.validateApiKey(apiKey);

      // Parse taskId to get orderId and userId
      const { orderId, userId } = this.parseTaskId(dto.taskId);

      // Find order via junction table
      const orderSource = await this.trafficOrderSourceRepository.findOne(
        { trafficSource: source.id, trafficOrder: { orderId } },
        { populate: ['trafficOrder'] },
      );

      const order = orderSource?.trafficOrder?.getEntity();

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

  // =====================================
  // PRIVATE HELPER METHODS
  // =====================================

  /**
   * Validate API key using bcrypt hash comparison
   */
  private async validateApiKey(apiKey: string): Promise<TrafficSourceEntity> {
    const source = await this.trafficSourceRepository.findByApiKey(apiKey);

    if (!source) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (source.status !== TrafficSourceStatus.Active) {
      throw new UnauthorizedException('API key belongs to inactive source');
    }

    // Populate categories relation
    const em = this.em.fork();
    await em.populate(source, ['categories', 'categories.category']);

    return source;
  }

  /**
   * Get source category types from populated categories relation
   */
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

  /**
   * Check if order matches ALL targeting requirements
   * Uses all parameters from GetTasksRequestDto
   */
  private matchesTargeting(order: TrafficOrderEntity, dto: GetTasksRequestDto, sourceCategoryTypes: string[]): boolean {
    const { requirements } = order;

    if (!requirements) {
      return true; // No targeting requirements
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

  /**
   * Check if source categories match order's allowed categories
   */
  private matchesCategories(requirements: Record<string, unknown>, sourceCategoryTypes: string[]): boolean {
    const { allowedCategories } = requirements;

    // Empty or undefined allowedCategories = all categories allowed
    if (!Array.isArray(allowedCategories) || allowedCategories.length === 0) {
      return true;
    }

    // Source must have at least one category that matches allowed categories
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
