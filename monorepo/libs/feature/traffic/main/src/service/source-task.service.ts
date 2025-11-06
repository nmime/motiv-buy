import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { add, getErrorMessage, toDbString } from '@app/common-shared';
import {
  CheckTaskStatusRequestDto,
  CheckTaskStatusResponseDto,
  CompleteTaskRequestDto,
  CompleteTaskResponseDto,
  GetFiltersResponseDto,
  GetTasksRequestDto,
  GetTasksResponseDto,
  TaskAction,
  TaskDto,
  TaskRequirementsDto,
  TaskTargetDto,
} from '@app/feature-traffic-shared';
import {
  TrafficActionsEntity,
  TrafficActionsRepository,
  TrafficActionStatus,
  TrafficActionType,
  TrafficOrderEntity,
  TrafficOrderRepository,
  TrafficOrderStatus,
  TrafficOrderType,
  TrafficSourceEntity,
  TrafficSourceRepository,
  TrafficTargetEntity,
  TrafficUserEntity,
} from '@app/database';

/**
 * Service for Public Traffic Source Task API
 * Handles task listing and completion (FlyerService/SubGram pattern)
 */
@Injectable()
export class SourceTaskService {
  private readonly logger = new Logger(SourceTaskService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly trafficSourceRepository: TrafficSourceRepository,
    private readonly trafficOrderRepository: TrafficOrderRepository,
    private readonly trafficActionsRepository: TrafficActionsRepository,
    @InjectRepository(TrafficUserEntity)
    private readonly trafficUserRepository: EntityRepository<TrafficUserEntity>,
  ) {}

  /**
   * Get available tasks for a traffic source
   * PUBLIC API with API key authentication
   */
  async getAvailableTasks(apiKey: string, query: GetTasksRequestDto): Promise<GetTasksResponseDto> {
    this.logger.log(`Getting available tasks for API key`);

    try {
      // Validate API key and get source
      const source = await this.validateApiKeyAndGetSource(apiKey);

      // Get active orders for this source
      const activeOrders = await this.trafficOrderRepository.findByTrafficSource(source.id, {
        status: TrafficOrderStatus.Active,
      });

      // Filter and map orders to tasks
      const tasks: TaskDto[] = [];

      const orderPromises = activeOrders.map(async (order) => {
        // Check if order has remaining slots
        if (order.currentCount >= order.targetCount) {
          return null;
        }

        // If userId provided, check if user already completed
        if (query.userId) {
          const hasCompleted = await this.hasUserCompletedTask(query.userId.toString(), order.id, source.id);

          if (hasCompleted) {
            return null;
          }
        }

        // Check targeting requirements
        if (!this.matchesTargeting(order, query)) {
          return null;
        }

        // Load target information
        const target = await order.trafficTarget.load();

        if (!target) {
          return null;
        }

        // Map to task DTO
        return this.mapOrderToTaskDto(order, target);
      });

      const results = await Promise.all(orderPromises);

      // Filter out null results
      for (const result of results) {
        if (result !== null) {
          tasks.push(result);
        }
      }

      // Apply limit
      const limit = query.limit || 50;
      const limitedTasks = tasks.slice(0, limit);

      this.logger.log(`Found ${limitedTasks.length} available tasks`);

      return {
        tasks: limitedTasks,
        total: tasks.length,
        message: limitedTasks.length === 0 ? 'No tasks available at the moment' : undefined,
      };
    } catch (err: unknown) {
      this.logger.error(`Get tasks failed: ${getErrorMessage(err)}`);
      throw new BadRequestException('Failed to get available tasks');
    }
  }

  /**
   * Complete a task
   * PUBLIC API with API key authentication
   */
  async completeTask(apiKey: string, taskId: string, dto: CompleteTaskRequestDto): Promise<CompleteTaskResponseDto> {
    this.logger.log(`Completing task ${taskId} for user ${dto.userId}`);

    try {
      return await this.em.transactional(async () => {
        // Validate API key and get source
        const source = await this.validateApiKeyAndGetSource(apiKey);

        // Find order by taskId (orderId)
        const order = await this.trafficOrderRepository.findByOrderId(taskId);

        if (!order) {
          return {
            success: false,
            error: 'Task not found',
          };
        }

        // Verify order belongs to this source
        const orderSource = await order.trafficSource.load();

        if (!orderSource || orderSource.id !== source.id) {
          return {
            success: false,
            error: 'Task does not belong to this source',
          };
        }

        // Check if order is still active
        if (order.status !== TrafficOrderStatus.Active) {
          return {
            success: false,
            error: 'Task is not active',
          };
        }

        // Check if order is full
        if (order.currentCount >= order.targetCount) {
          return {
            success: false,
            error: 'Task is full',
          };
        }

        // Find or create traffic user
        let trafficUser = await this.trafficUserRepository.findOne({
          telegramId: dto.userId.toString(),
          trafficSource: source.id,
        });

        if (!trafficUser) {
          trafficUser = new TrafficUserEntity({
            telegramId: dto.userId.toString(),
            username: dto.username,
            firstName: dto.username || `User ${dto.userId}`,
            trafficSourceId: source.id,
          });

          await this.em.persistAndFlush(trafficUser);
        }

        // Check if user already completed this task
        const hasCompleted = await this.hasUserCompletedTask(dto.userId.toString(), order.id, source.id);

        if (hasCompleted) {
          return {
            success: false,
            error: 'Task already completed by this user',
          };
        }

        // Map task action type
        const actionType = this.mapTaskActionToActionType(order.type);

        // Create action record
        const action = new TrafficActionsEntity({
          actionId: this.generateActionId(),
          type: actionType,
          status: TrafficActionStatus.Completed,
          description: `Completed by user ${dto.userId}`,
          reward: order.pricePerAction,
          completedAt: dto.completedAt ? new Date(dto.completedAt) : new Date(),
          actionData: dto.proof,
          trafficOrderId: order.id,
          trafficSourceId: source.id,
        });

        await this.em.persistAndFlush(action);

        // Update order progress
        order.currentCount += 1;
        const spent = add(order.spentAmount, order.pricePerAction);
        order.spentAmount = toDbString(spent, 4);

        // Check if order is completed
        if (order.currentCount >= order.targetCount) {
          order.status = TrafficOrderStatus.Completed;
        }

        // Update user earnings
        const newEarnings = add(trafficUser.totalEarnings, order.pricePerAction);
        trafficUser.totalEarnings = toDbString(newEarnings, 8);
        trafficUser.totalOrdersParticipated += 1;
        trafficUser.lastSeenAt = new Date();

        await this.em.flush();

        this.logger.log(`Task completed: ${action.id}, reward: ${action.reward}`);

        return {
          success: true,
          actionId: action.id,
          status: 'verified',
          reward: action.reward,
          message: 'Task completed successfully',
        };
      });
    } catch (err: unknown) {
      this.logger.error(`Complete task failed: ${getErrorMessage(err)}`);

      return {
        success: false,
        error: 'Failed to complete task',
      };
    }
  }

  /**
   * Check task status for a user
   * PUBLIC API with API key authentication
   */
  async checkTaskStatus(
    apiKey: string,
    taskId: string,
    query: CheckTaskStatusRequestDto,
  ): Promise<CheckTaskStatusResponseDto> {
    this.logger.log(`Checking status for task ${taskId} and user ${query.userId}`);

    try {
      // Validate API key and get source
      const source = await this.validateApiKeyAndGetSource(apiKey);

      // Find order
      const order = await this.trafficOrderRepository.findByOrderId(taskId);

      if (!order) {
        throw new NotFoundException('Task not found');
      }

      // Check if action exists for this user and task
      const action = await this.trafficActionsRepository.findOne({
        trafficOrder: order.id,
        trafficSource: source.id,
      });

      if (!action) {
        return {
          taskId,
          status: 'not_started',
          canSubmit: true,
          message: 'Task not started yet',
        };
      }

      // Map action status
      const statusMap: Record<TrafficActionStatus, string> = {
        [TrafficActionStatus.Pending]: 'pending',
        [TrafficActionStatus.InProgress]: 'in_progress',
        [TrafficActionStatus.Completed]: 'completed',
        [TrafficActionStatus.Failed]: 'failed',
        [TrafficActionStatus.Cancelled]: 'cancelled',
      };

      const status = statusMap[action.status] ?? 'unknown';
      const canSubmit = action.status !== TrafficActionStatus.Completed;

      return {
        taskId,
        status,
        canSubmit,
        message: action.status === TrafficActionStatus.Completed ? 'Task already completed' : 'Task in progress',
        completedAt: action.completedAt?.toISOString(),
      };
    } catch (err: unknown) {
      this.logger.error(`Check status failed: ${getErrorMessage(err)}`);
      throw new NotFoundException('Failed to check task status');
    }
  }

  /**
   * Get available filters (PUBLIC - no auth)
   */
  async getFilters(): Promise<GetFiltersResponseDto> {
    // Return static filter data
    return {
      genders: ['male', 'female'],
      ageRanges: [
        { label: '18-24', min: 18, max: 24 },
        { label: '25-34', min: 25, max: 34 },
        { label: '35-44', min: 35, max: 44 },
        { label: '45-54', min: 45, max: 54 },
        { label: '55+', min: 55, max: 100 },
      ],
      countries: [
        { code: 'US', name: 'United States' },
        { code: 'RU', name: 'Russia' },
        { code: 'UA', name: 'Ukraine' },
        { code: 'GB', name: 'United Kingdom' },
        { code: 'DE', name: 'Germany' },
        { code: 'FR', name: 'France' },
        { code: 'IT', name: 'Italy' },
        { code: 'ES', name: 'Spain' },
      ],
      languages: [
        { code: 'en', name: 'English' },
        { code: 'ru', name: 'Russian' },
        { code: 'uk', name: 'Ukrainian' },
        { code: 'de', name: 'German' },
        { code: 'fr', name: 'French' },
        { code: 'es', name: 'Spanish' },
      ],
      taskTypes: [
        { type: 'subscribe', displayName: 'Channel Subscribe', basePrice: '0.10' },
        { type: 'join', displayName: 'Group Join', basePrice: '0.08' },
        { type: 'view', displayName: 'Post View', basePrice: '0.02' },
        { type: 'react', displayName: 'Post React', basePrice: '0.05' },
        { type: 'comment', displayName: 'Post Comment', basePrice: '0.15' },
      ],
    };
  }

  // =====================================
  // PRIVATE HELPER METHODS
  // =====================================

  /**
   * Validate API key and get traffic source
   */
  private async validateApiKeyAndGetSource(apiKey: string): Promise<TrafficSourceEntity> {
    // For now, use botToken as API key
    // TODO: Add dedicated apiKey field to TrafficSourceEntity
    const source = await this.trafficSourceRepository.findOne({
      botToken: apiKey,
    });

    if (!source) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!source.isActive) {
      throw new UnauthorizedException('Traffic source is not active');
    }

    return source;
  }

  /**
   * Check if user has completed task
   */
  private async hasUserCompletedTask(_userId: string, orderId: string, _sourceId: string): Promise<boolean> {
    const action = await this.trafficActionsRepository.findOne({
      trafficOrder: orderId,
      status: TrafficActionStatus.Completed,
    });

    return action !== null;
  }

  /**
   * Check if order matches targeting requirements
   */
  private matchesTargeting(order: TrafficOrderEntity, query: GetTasksRequestDto): boolean {
    const requirements = order.requirements as TaskRequirementsDto | undefined;

    if (!requirements) {
      return true;
    }

    return (
      this.matchesGender(requirements, query) &&
      this.matchesAge(requirements, query) &&
      this.matchesCountry(requirements, query) &&
      this.matchesLanguage(requirements, query)
    );
  }

  private matchesGender(requirements: TaskRequirementsDto, query: GetTasksRequestDto): boolean {
    if (!requirements.gender || !query.gender) {
      return true;
    }

    return requirements.gender === query.gender;
  }

  private matchesAge(requirements: TaskRequirementsDto, query: GetTasksRequestDto): boolean {
    if (!query.age) {
      return true;
    }

    if (requirements.minAge && query.age < requirements.minAge) {
      return false;
    }

    if (requirements.maxAge && query.age > requirements.maxAge) {
      return false;
    }

    return true;
  }

  private matchesCountry(requirements: TaskRequirementsDto, query: GetTasksRequestDto): boolean {
    if (!requirements.countries || requirements.countries.length === 0 || !query.country) {
      return true;
    }

    return requirements.countries.includes(query.country);
  }

  private matchesLanguage(requirements: TaskRequirementsDto, query: GetTasksRequestDto): boolean {
    if (!requirements.languages || requirements.languages.length === 0 || !query.languageCode) {
      return true;
    }

    return requirements.languages.includes(query.languageCode);
  }

  /**
   * Map order entity to task DTO
   */
  private mapOrderToTaskDto(order: TrafficOrderEntity, target: TrafficTargetEntity): TaskDto {
    // Map order type to task action
    const actionMap: Record<TrafficOrderType, TaskAction> = {
      [TrafficOrderType.Subscribe]: TaskAction.Subscribe,
      [TrafficOrderType.Join]: TaskAction.Join,
      [TrafficOrderType.View]: TaskAction.View,
      [TrafficOrderType.React]: TaskAction.React,
      [TrafficOrderType.Comment]: TaskAction.Comment,
      [TrafficOrderType.Unsubscribe]: TaskAction.Subscribe, // Map to subscribe
      [TrafficOrderType.Leave]: TaskAction.Join, // Map to join
      [TrafficOrderType.Share]: TaskAction.View, // Map to view
      [TrafficOrderType.Vote]: TaskAction.React, // Map to react
    };

    const action = actionMap[order.type] ?? TaskAction.View;

    // Build target DTO
    const targetDto: TaskTargetDto = {
      type: target.type,
      username: target.username || '',
      link: target.inviteLink || target.username || '',
      name: target.name,
      telegramId: target.telegramId,
    };

    // Build requirements DTO if present
    let requirementsDto: TaskRequirementsDto | undefined;

    if (order.requirements) {
      const req = order.requirements as TaskRequirementsDto;
      requirementsDto = {
        minAge: req.minAge,
        maxAge: req.maxAge,
        gender: req.gender,
        countries: req.countries,
        languages: req.languages,
      };
    }

    // Calculate remaining slots
    const remainingSlots = Math.max(0, order.targetCount - order.currentCount);

    return {
      taskId: order.orderId,
      action,
      target: targetDto,
      reward: order.pricePerAction,
      requirements: requirementsDto,
      description: order.description,
      remainingSlots,
    };
  }

  /**
   * Map task action to traffic action type
   */
  private mapTaskActionToActionType(orderType: TrafficOrderType): TrafficActionType {
    const actionMap: Record<TrafficOrderType, TrafficActionType> = {
      [TrafficOrderType.Subscribe]: TrafficActionType.Subscribe,
      [TrafficOrderType.Unsubscribe]: TrafficActionType.Unsubscribe,
      [TrafficOrderType.Join]: TrafficActionType.Join,
      [TrafficOrderType.Leave]: TrafficActionType.Leave,
      [TrafficOrderType.View]: TrafficActionType.View,
      [TrafficOrderType.React]: TrafficActionType.React,
      [TrafficOrderType.Comment]: TrafficActionType.Comment,
      [TrafficOrderType.Share]: TrafficActionType.Share,
      [TrafficOrderType.Vote]: TrafficActionType.Vote,
    };

    return actionMap[orderType] ?? TrafficActionType.View;
  }

  /**
   * Generate unique action ID
   */
  private generateActionId(): string {
    const timestamp = Date.now();
    // Math.random() is acceptable for action IDs
    // eslint-disable-next-line sonarjs/pseudo-random
    const random = Math.floor(Math.random() * 10000);

    return `ACT-${timestamp}-${random}`;
  }
}
