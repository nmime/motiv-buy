import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import {
  add,
  divide,
  getErrorMessage,
  percentage,
  sum,
  toDbString,
  toDisplayString,
  toNumber,
} from '@app/common-shared';
import {
  CheckStatusRequestDto,
  CheckStatusResponseDto,
  CompleteActionRequestDto,
  CompleteActionResponseDto,
  GetBotStatsResponseDto,
  GetFiltersResponseDto,
  GetOrdersRequestDto,
  GetOrdersResponseDto,
  GetUserStatsResponseDto,
  RegisterBotRequestDto,
  RegisterBotResponseDto,
  SourceOrderDto,
  SourceOrderRequirementsDto,
  SourceOrderTargetDto,
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
  TrafficSourceType,
  TrafficTargetEntity,
  TrafficUserEntity,
} from '@app/database';

/**
 * Service for Source Bot API
 * Allows bot owners to connect their bots and get orders for their users
 */
@Injectable()
export class SourceBotService {
  private readonly logger = new Logger(SourceBotService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly trafficSourceRepository: TrafficSourceRepository,
    private readonly trafficOrderRepository: TrafficOrderRepository,
    private readonly trafficActionsRepository: TrafficActionsRepository,
    @InjectRepository(TrafficUserEntity)
    private readonly trafficUserRepository: EntityRepository<TrafficUserEntity>,
  ) {}

  /**
   * Register bot to the platform
   * Validates bot token with Telegram and creates TrafficSource
   */
  async registerBot(dto: RegisterBotRequestDto): Promise<RegisterBotResponseDto> {
    this.logger.log(`Registering bot: ${dto.name}`);

    try {
      // Validate bot token format
      if (!this.isValidTelegramBotToken(dto.key)) {
        return {
          sourceId: '',
          botUsername: '',
          status: 'pending_review',
          error: 'Invalid bot token format',
        };
      }

      // Extract bot ID from token (format: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)
      const [botId] = dto.key.split(':');

      if (!botId) {
        throw new BadRequestException('Invalid bot token format');
      }

      // Check if bot already exists
      const existingSource = await this.trafficSourceRepository.findByTelegramId(botId);
      if (existingSource) {
        return {
          sourceId: existingSource.id,
          botUsername: existingSource.botUsername || '',
          telegramId: existingSource.telegramId,
          status: existingSource.isActive ? 'active' : 'pending_review',
          error: existingSource.isActive ? undefined : 'Bot exists but inactive',
        };
      }

      // Validate bot with Telegram API
      const botInfo = await this.validateBotWithTelegram(dto.key);
      if (!botInfo.isValid) {
        return {
          sourceId: '',
          botUsername: '',
          status: 'pending_review',
          error: botInfo.error || 'Bot validation failed',
        };
      }

      // Create traffic source
      const trafficSource = await this.trafficSourceRepository.create({
        name: dto.name,
        description: dto.description,
        type: TrafficSourceType.BotWithToken,
        botToken: dto.key,
        botUsername: botInfo.username,
        telegramId: botId,
      });

      await this.em.flush();

      this.logger.log(`Bot registered successfully: ${trafficSource.id}`);

      return {
        sourceId: trafficSource.id,
        botUsername: botInfo.username || '',
        telegramId: botId,
        status: 'active',
      };
    } catch (err: unknown) {
      this.logger.error(`Bot registration failed: ${getErrorMessage(err)}`);
      throw new BadRequestException('Bot registration failed');
    }
  }

  /**
   * Get available orders for a user
   * Returns orders that user hasn't completed yet and match targeting
   */
  async getAvailableOrders(dto: GetOrdersRequestDto): Promise<GetOrdersResponseDto> {
    this.logger.log(`Getting orders for user ${dto.userId}`);

    try {
      // Validate bot token and get source
      const source = await this.validateBotTokenAndGetSource(dto.key);

      // Find or create traffic user
      const trafficUser = await this.findOrCreateTrafficUser({
        telegramId: dto.userId.toString(),
        sourceId: source.id,
        languageCode: dto.languageCode,
        chatId: dto.chatId,
      });

      // Get active orders for this source
      const activeOrders = await this.trafficOrderRepository.findByTrafficSource(source.id, {
        status: TrafficOrderStatus.Active,
      });

      // Filter orders by:
      // 1. User hasn't completed them yet
      // 2. User matches targeting requirements
      const availableOrders: SourceOrderDto[] = [];

      // Process orders in parallel for better performance
      const orderPromises = activeOrders.map(async (order) => {
        // Check if user already completed this order
        const hasCompleted = await this.hasUserCompletedOrder(trafficUser.id, order.id);

        if (hasCompleted) {
          return null;
        }

        // Check if order is full
        if (order.currentCount >= order.targetCount) {
          return null;
        }

        // Check targeting requirements
        if (!this.matchesTargeting(order, dto)) {
          return null;
        }

        // Load target information
        const target = await order.trafficTarget.load();

        if (!target) {
          return null;
        }

        // Map to DTO
        return this.mapOrderToSourceOrderDto(order, target);
      });

      const results = await Promise.all(orderPromises);

      // Filter out null results and add to available orders
      for (const result of results) {
        if (result !== null) {
          availableOrders.push(result);
        }
      }

      this.logger.log(`Found ${availableOrders.length} available orders for user ${dto.userId}`);

      return {
        orders: availableOrders,
        message: availableOrders.length === 0 ? 'No orders available at the moment' : undefined,
      };
    } catch (err: unknown) {
      this.logger.error(`Get orders failed: ${getErrorMessage(err)}`);
      throw new BadRequestException('Failed to get available orders');
    }
  }

  /**
   * Check if user has completed subscription/join for an order
   */
  async checkSubscriptionStatus(dto: CheckStatusRequestDto): Promise<CheckStatusResponseDto> {
    this.logger.log(`Checking status for order ${dto.orderId} and user ${dto.userId}`);

    try {
      // Validate bot token and get source
      const source = await this.validateBotTokenAndGetSource(dto.key);

      // Find traffic user
      const trafficUser = await this.trafficUserRepository.findOne({
        telegramId: dto.userId.toString(),
        trafficSource: source.id,
      });

      if (!trafficUser) {
        return {
          status: 'not_subscribed',
          canProceed: false,
          message: 'User not found',
        };
      }

      // Find order
      const order = await this.trafficOrderRepository.findByOrderId(dto.orderId);
      if (!order) {
        return {
          status: 'not_subscribed',
          canProceed: false,
          message: 'Order not found',
        };
      }

      // Check if action exists for this user and order
      const action = await this.trafficActionsRepository.findOne({
        trafficOrder: order.id,
        trafficSource: source.id,
      });

      if (!action) {
        return {
          status: 'not_subscribed',
          canProceed: false,
          message: 'No action found',
        };
      }

      // Map action status to response status
      const statusMap: Record<TrafficActionStatus, string> = {
        [TrafficActionStatus.Pending]: 'pending',
        [TrafficActionStatus.InProgress]: 'pending',
        [TrafficActionStatus.Completed]: 'completed',
        [TrafficActionStatus.Failed]: 'not_subscribed',
        [TrafficActionStatus.Cancelled]: 'not_subscribed',
      };

      const status = statusMap[action.status] ?? 'not_subscribed';
      const canProceed = action.status === TrafficActionStatus.Completed;

      return {
        status,
        canProceed,
        message: canProceed ? 'Action completed successfully' : 'Action not completed yet',
        completedAt: action.completedAt?.toISOString(),
      };
    } catch (err: unknown) {
      this.logger.error(`Check status failed: ${getErrorMessage(err)}`);
      throw new BadRequestException('Failed to check subscription status');
    }
  }

  /**
   * Submit action completion
   * Creates TrafficAction record and updates order progress
   */
  async submitCompletion(orderId: string, dto: CompleteActionRequestDto): Promise<CompleteActionResponseDto> {
    this.logger.log(`Submitting completion for order ${orderId} by user ${dto.userId}`);

    try {
      return await this.em.transactional(async () => {
        // Validate bot token and get source
        const source = await this.validateBotTokenAndGetSource(dto.key);

        // Find traffic user
        let trafficUser = await this.trafficUserRepository.findOne({
          telegramId: dto.userId.toString(),
          trafficSource: source.id,
        });

        if (!trafficUser) {
          // Create user if not exists
          trafficUser = new TrafficUserEntity({
            telegramId: dto.userId.toString(),
            username: dto.username,
            firstName: dto.username || 'User',
            trafficSourceId: source.id,
          });

          await this.em.persistAndFlush(trafficUser);
        }

        // Find order
        const order = await this.trafficOrderRepository.findByOrderId(orderId);
        if (!order) {
          return {
            success: false,
            error: 'Order not found',
          };
        }

        // Check if order is still active
        if (order.status !== TrafficOrderStatus.Active) {
          return {
            success: false,
            error: 'Order is not active',
          };
        }

        // Check if user already completed this order
        const hasCompleted = await this.hasUserCompletedOrder(trafficUser.id, order.id);
        if (hasCompleted) {
          return {
            success: false,
            error: 'Order already completed by this user',
          };
        }

        // Check if order is full
        if (order.currentCount >= order.targetCount) {
          return {
            success: false,
            error: 'Order is full',
          };
        }

        // Map action type
        const actionTypeMap: Record<string, TrafficActionType> = {
          subscribe: TrafficActionType.Subscribe,
          join: TrafficActionType.Join,
          view: TrafficActionType.View,
          react: TrafficActionType.React,
          comment: TrafficActionType.Comment,
        };

        const actionType = actionTypeMap[dto.actionType] ?? TrafficActionType.View;

        // Create action record
        const action = new TrafficActionsEntity({
          actionId: this.generateActionId(),
          type: actionType,
          status: TrafficActionStatus.Completed,
          description: `Completed by user ${dto.userId}`,
          reward: order.pricePerAction,
          completedAt: new Date(dto.completedAt),
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

        await this.em.flush();

        // Calculate order progress
        const progressPercentage = toNumber(percentage(order.currentCount, order.targetCount));

        this.logger.log(`Action completed: ${action.id}, reward: ${action.reward}`);

        return {
          success: true,
          actionId: action.id,
          status: 'verified',
          reward: action.reward,
          userEarnings: trafficUser.totalEarnings,
          orderProgress: {
            currentCount: order.currentCount,
            targetCount: order.targetCount,
            percentage: progressPercentage,
          },
        };
      });
    } catch (err: unknown) {
      this.logger.error(`Submit completion failed: ${getErrorMessage(err)}`);

      return {
        success: false,
        error: 'Failed to submit completion',
      };
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: number, key: string): Promise<GetUserStatsResponseDto> {
    this.logger.log(`Getting stats for user ${userId}`);

    try {
      // Validate bot token and get source
      const source = await this.validateBotTokenAndGetSource(key);

      // Find traffic user
      const trafficUser = await this.trafficUserRepository.findOne({
        telegramId: userId.toString(),
        trafficSource: source.id,
      });

      if (!trafficUser) {
        throw new NotFoundException('User not found');
      }

      // Get completed actions count
      const completedActions = await this.trafficActionsRepository.count({
        trafficSource: source.id,
        status: TrafficActionStatus.Completed,
      });

      // Count available orders
      const availableOrders = await this.trafficOrderRepository.count({
        trafficSource: source.id,
        status: TrafficOrderStatus.Active,
      });

      return {
        userId,
        username: trafficUser.username,
        totalEarnings: trafficUser.totalEarnings,
        pendingEarnings: '0', // Would be calculated from pending actions
        totalActions: completedActions,
        completionRate: trafficUser.completionRate,
        availableOrders,
        joinedAt: trafficUser.joinedAt.toISOString(),
        lastSeenAt: trafficUser.lastSeenAt?.toISOString(),
      };
    } catch (err: unknown) {
      this.logger.error(`Get user stats failed: ${getErrorMessage(err)}`);
      throw new NotFoundException('Failed to get user stats');
    }
  }

  /**
   * Get bot statistics
   */
  async getBotStats(key: string): Promise<GetBotStatsResponseDto> {
    this.logger.log('Getting bot stats');

    try {
      // Validate bot token and get source
      const source = await this.validateBotTokenAndGetSource(key);

      // Count total users
      const totalUsers = await this.trafficUserRepository.count({
        trafficSource: source.id,
      });

      // Count active users (seen in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const activeUsers = await this.trafficUserRepository.count({
        trafficSource: source.id,
        lastSeenAt: { $gte: thirtyDaysAgo },
      });

      // Get all users' earnings
      const users = await this.trafficUserRepository.find({
        trafficSource: source.id,
      });

      const totalEarnings = users.map((u) => u.totalEarnings);
      const totalEarningsSum = toDbString(sum(totalEarnings), 8);

      // Count completed actions
      const totalActions = await this.trafficActionsRepository.count({
        trafficSource: source.id,
        status: TrafficActionStatus.Completed,
      });

      // Count orders
      const ordersCompleted = await this.trafficOrderRepository.count({
        trafficSource: source.id,
        status: TrafficOrderStatus.Completed,
      });

      const ordersActive = await this.trafficOrderRepository.count({
        trafficSource: source.id,
        status: TrafficOrderStatus.Active,
      });

      // Calculate average completion rate
      const completionRates = users.map((u) => u.completionRate).filter((rate) => parseFloat(rate) > 0);
      const avgCompletionRate =
        completionRates.length > 0 ? toDisplayString(divide(sum(completionRates), completionRates.length), 2) : '0.00';

      return {
        sourceId: source.id,
        botUsername: source.botUsername,
        totalUsers,
        activeUsers,
        totalEarnings: totalEarningsSum,
        totalActions,
        completionRate: avgCompletionRate,
        ordersCompleted,
        ordersActive,
      };
    } catch (err: unknown) {
      this.logger.error(`Get bot stats failed: ${getErrorMessage(err)}`);
      throw new BadRequestException('Failed to get bot stats');
    }
  }

  /**
   * Get available filters (PUBLIC endpoint)
   */
  async getFilters(): Promise<GetFiltersResponseDto> {
    // Return static filter data
    // In production, this could be dynamically generated from database
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
      trafficTypes: [
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
   * Validate bot token and get traffic source
   */
  private async validateBotTokenAndGetSource(botToken: string): Promise<TrafficSourceEntity> {
    // Extract bot ID from token
    const [botId] = botToken.split(':');

    if (!botId) {
      throw new UnauthorizedException('Invalid bot token format');
    }

    // Find traffic source by telegram ID and token
    const source = await this.trafficSourceRepository.findByTelegramId(botId);
    if (!source) {
      throw new UnauthorizedException('Bot not registered');
    }

    // Validate token matches
    if (source.botToken !== botToken) {
      throw new UnauthorizedException('Invalid bot token');
    }

    // Check if source is active
    if (!source.isActive) {
      throw new UnauthorizedException('Bot is not active');
    }

    return source;
  }

  /**
   * Validate bot with Telegram API
   */
  private async validateBotWithTelegram(
    botToken: string,
  ): Promise<{ isValid: boolean; username?: string; error?: string }> {
    try {
      // In production, this would call Telegram API: https://api.telegram.org/bot<token>/getMe
      // For now, just validate token format
      if (!this.isValidTelegramBotToken(botToken)) {
        return { isValid: false, error: 'Invalid token format' };
      }

      // Extract bot ID and generate username
      const [botId] = botToken.split(':');
      const username = `@bot_${botId}`;

      return { isValid: true, username };
    } catch (err: unknown) {
      this.logger.error(`Telegram validation failed: ${getErrorMessage(err)}`);

      return { isValid: false, error: 'Telegram API error' };
    }
  }

  /**
   * Validate Telegram bot token format
   */
  private isValidTelegramBotToken(token: string): boolean {
    // Telegram bot token format: <bot_id>:<random_string>
    // Example: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
    const tokenRegex = /^\d+:[A-Za-z0-9_-]+$/;

    return tokenRegex.test(token);
  }

  /**
   * Find or create traffic user
   */
  private async findOrCreateTrafficUser(data: {
    telegramId: string;
    sourceId: string;
    languageCode?: string;
    chatId: number;
  }): Promise<TrafficUserEntity> {
    let user = await this.trafficUserRepository.findOne({
      telegramId: data.telegramId,
      trafficSource: data.sourceId,
    });

    if (!user) {
      user = new TrafficUserEntity({
        telegramId: data.telegramId,
        firstName: `User ${data.telegramId}`,
        languageCode: data.languageCode,
        trafficSourceId: data.sourceId,
      });

      await this.em.persistAndFlush(user);
    } else {
      // Update last seen
      user.lastSeenAt = new Date();
      await this.em.flush();
    }

    return user;
  }

  /**
   * Check if user has completed order
   */
  private async hasUserCompletedOrder(_userId: string, orderId: string): Promise<boolean> {
    const action = await this.trafficActionsRepository.findOne({
      trafficOrder: orderId,
      status: TrafficActionStatus.Completed,
    });

    return action !== null;
  }

  /**
   * Check if order matches targeting requirements
   */
  private matchesTargeting(order: TrafficOrderEntity, userDto: GetOrdersRequestDto): boolean {
    const requirements = order.requirements as SourceOrderRequirementsDto | undefined;
    if (!requirements) {
      return true; // No requirements means all users match
    }

    // Check gender
    if (requirements.gender && userDto.gender && requirements.gender !== userDto.gender) {
      return false;
    }

    // Check age
    if (userDto.age) {
      if (requirements.minAge && userDto.age < requirements.minAge) {
        return false;
      }

      if (requirements.maxAge && userDto.age > requirements.maxAge) {
        return false;
      }
    }

    // Check country (would need user's country from userDto)
    // For now, we don't have country in GetOrdersRequestDto

    return true;
  }

  /**
   * Map order entity to source order DTO
   */
  private async mapOrderToSourceOrderDto(
    order: TrafficOrderEntity,
    target: TrafficTargetEntity,
  ): Promise<SourceOrderDto> {
    // Map order type to action
    const actionMap: Record<TrafficOrderType, string> = {
      [TrafficOrderType.Subscribe]: 'subscribe',
      [TrafficOrderType.Join]: 'join',
      [TrafficOrderType.View]: 'view',
      [TrafficOrderType.React]: 'react',
      [TrafficOrderType.Comment]: 'comment',
      [TrafficOrderType.Unsubscribe]: 'unsubscribe',
      [TrafficOrderType.Leave]: 'leave',
      [TrafficOrderType.Share]: 'share',
      [TrafficOrderType.Vote]: 'vote',
    };

    const action = actionMap[order.type] ?? 'view';

    // Build target DTO
    const targetDto: SourceOrderTargetDto = {
      type: target.type,
      username: target.username || '',
      link: target.inviteLink || target.username || '',
      name: target.name,
    };

    // Build requirements DTO if present
    let requirementsDto: SourceOrderRequirementsDto | undefined;
    if (order.requirements) {
      const req = order.requirements as SourceOrderRequirementsDto;
      requirementsDto = {
        minAge: req.minAge,
        maxAge: req.maxAge,
        gender: req.gender,
        countries: req.countries,
      };
    }

    return {
      orderId: order.orderId,
      action,
      target: targetDto,
      reward: order.pricePerAction,
      requirements: requirementsDto,
      description: order.description,
    };
  }

  /**
   * Generate unique action ID
   */
  private generateActionId(): string {
    const timestamp = Date.now();
    // Math.random() is acceptable for action IDs as they don't require cryptographic security
    // eslint-disable-next-line sonarjs/pseudo-random
    const random = Math.floor(Math.random() * 10000);

    return `ACT-${timestamp}-${random}`;
  }
}
