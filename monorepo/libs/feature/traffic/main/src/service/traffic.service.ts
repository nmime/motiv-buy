import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import {
  ITrafficService,
  CreateBotDto,
  BotValidationDto,
  BotCreationResponseDto,
  BotSettingsDto,
  UpdateBotSettingsDto,
  BotActionDto,
  BotResponseDto,
  CreateTrafficOrderDto,
  TrafficOrderResponseDto,
  UpdateTrafficOrderDto,
  AvailableTrafficDto,
  BotStatus,
  BotAction,
  TrafficType,
  OrderStatus,
  BotTokenValidationDto,
  BotTokenValidationResponseDto,
} from '@app/feature-traffic-shared';
import {
  TrafficTargetEntity,
  TrafficSourceEntity,
  TrafficOrderEntity,
  TrafficUserEntity,
  TrafficTargetType,
  TrafficSourceType,
  TrafficOrderType,
  TrafficOrderStatus,
  UserEntity,
} from '@app/database';
import { ITrafficTargetRepository, ITrafficSourceRepository, ITrafficOrderRepository } from '../repository';
import { TrafficTargetMapper, TrafficSourceMapper, TrafficOrderMapper } from '../mapper';
import { BotTokenValidationService } from '@app/feature-traffic-shared';

/**
 * Service for managing traffic bots and traffic purchase orders
 * Implements buy/sell architecture for traffic management
 */
@Injectable()
export class TrafficService implements ITrafficService {
  private readonly logger = new Logger(TrafficService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly trafficTargetRepository: ITrafficTargetRepository,
    private readonly trafficSourceRepository: ITrafficSourceRepository,
    private readonly trafficOrderRepository: ITrafficOrderRepository,
    @InjectRepository(UserEntity)
    private readonly userRepository: EntityRepository<UserEntity>,
    private readonly botTokenValidationService: BotTokenValidationService,
  ) {}

  // =====================================================
  // BOT MANAGEMENT METHODS (Traffic Sources - SELL SIDE)
  // =====================================================

  /**
   * Validate bot existence
   */
  async validateBot(dto: BotValidationDto): Promise<{ exists: boolean; message: string }> {
    this.logger.log(`Validating bot: ${dto.username}`);

    try {
      const existingSource = await this.trafficSourceRepository.findByBotUsername(dto.username);

      if (existingSource) {
        return {
          exists: true,
          message: 'Bot already exists in the system',
        };
      }

      // Here you could add Telegram API validation
      // For now, we'll do basic username validation
      if (!dto.username.startsWith('@') || dto.username.length < 5) {
        return {
          exists: false,
          message: 'Invalid bot username format',
        };
      }

      return {
        exists: false,
        message: 'Bot username is available',
      };
    } catch (error) {
      this.logger.error(`Bot validation failed: ${error.message}`);
      throw new BadRequestException('Bot validation failed');
    }
  }

  /**
   * Create bot for traffic sales
   */
  async createBot(dto: CreateBotDto, userId: string, _botAuth?: unknown): Promise<BotCreationResponseDto> {
    this.logger.log(`Creating bot for user ${userId}: ${dto.botUsername}`);

    await this.em.transactional(async (_em) => {
      // Validate user exists
      const user = await this.userRepository.findOne({ id: userId });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if bot already exists
      const existingSource = await this.trafficSourceRepository.findByBotUsername(dto.botUsername);
      if (existingSource) {
        throw new BadRequestException('Bot already exists');
      }

      // Create traffic source (bot)
      const trafficSource = await this.trafficSourceRepository.create({
        name: `Traffic Bot ${dto.botUsername}`,
        description: `Traffic source bot created by user ${userId}`,
        type: TrafficSourceType.BotWithToken,
        botUsername: dto.botUsername,
        managedById: userId,
      });

      this.logger.log(`Traffic source created for bot: ${trafficSource.id}`);
    });

    return {
      botId: 'pending-moderation', // Will be updated after moderation
      status: 'pending_moderation',
      message: 'Бот создан и отправлен на модерацию',
      estimatedModerationTime: '24-48 часов',
    };
  }

  /**
   * Get bot settings
   */
  async getBotSettings(botId: string, userId: string): Promise<BotSettingsDto> {
    const source = await this.trafficSourceRepository.findById(botId);
    if (!source) {
      throw new NotFoundException('Bot not found');
    }

    // Check access
    const hasAccess = await this.trafficSourceRepository.validateSourceAccess(botId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return {
      botId: source.id,
      botUsername: source.botUsername || '',
      isActive: source.isActive,
      trafficTypes: [TrafficType.PrivateMessages, TrafficType.GroupMessages],
      priceSettings: {
        privateMessages: 0.05,
        groupMessages: 0.03,
        channelSubscribers: 0.1,
        postViews: 0.02,
      },
      dailyLimits: {
        privateMessages: 1000,
        groupMessages: 500,
        channelSubscribers: 200,
        postViews: 5000,
      },
      excludedThemes: [],
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  }

  /**
   * Update bot settings
   */
  async updateBotSettings(botId: string, dto: UpdateBotSettingsDto, userId: string): Promise<BotSettingsDto> {
    this.logger.log(`Updating bot settings: ${botId}`);

    const source = await this.trafficSourceRepository.findById(botId);
    if (!source) {
      throw new NotFoundException('Bot not found');
    }

    // Check access
    const hasAccess = await this.trafficSourceRepository.validateSourceAccess(botId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    // Update source configuration
    const updatedConfig = {
      ...source.config,
      priceSettings: dto.priceSettings,
      dailyLimits: dto.dailyLimits,
      excludedThemes: dto.excludedThemes,
    };

    await this.trafficSourceRepository.update(botId, {
      isActive: dto.isActive,
      config: updatedConfig,
    });

    return this.getBotSettings(userId, botId);
  }

  /**
   * Perform bot action (start/pause/delete)
   */
  async performBotAction(botId: string, dto: BotActionDto, userId: string): Promise<{ message: string }> {
    this.logger.log(`Performing bot action: ${dto.action} on ${botId}`);

    const source = await this.trafficSourceRepository.findById(botId);
    if (!source) {
      throw new NotFoundException('Bot not found');
    }

    // Check access
    const hasAccess = await this.trafficSourceRepository.validateSourceAccess(botId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    switch (dto.action) {
      case BotAction.Start:
        await this.trafficSourceRepository.update(botId, { isActive: true });

        return { message: 'Bot started successfully' };

      case BotAction.Pause:
        await this.trafficSourceRepository.update(botId, { isActive: false });

        return { message: 'Bot paused successfully' };

      case BotAction.Delete:
        await this.trafficSourceRepository.deactivate(botId);

        return { message: 'Bot deleted successfully' };

      default:
        throw new BadRequestException('Invalid action');
    }
  }

  /**
   * Get all user bots
   */
  async getUserBots(userId: string, _botAuth?: unknown): Promise<BotResponseDto[]> {
    const sources = await this.trafficSourceRepository.findByManager(userId);

    return sources.map((source) => ({
      botId: source.id,
      botUsername: source.botUsername || '',
      status: source.isActive ? BotStatus.Active : BotStatus.Paused,
      trafficTypes: [TrafficType.PrivateMessages, TrafficType.GroupMessages],
      totalEarnings: '0.0000', // Would be calculated from actual orders
      todayEarnings: '0.0000',
      activeOrders: 0, // Would be calculated from actual orders
      lastActivity: source.updatedAt,
      createdAt: source.createdAt,
    }));
  }

  /**
   * Get specific bot details
   */
  async getBotDetails(botId: string, userId: string): Promise<BotResponseDto> {
    const source = await this.trafficSourceRepository.findById(botId);
    if (!source) {
      throw new NotFoundException('Bot not found');
    }

    // Check access
    const hasAccess = await this.trafficSourceRepository.validateSourceAccess(botId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return {
      botId: source.id,
      botUsername: source.botUsername || '',
      status: source.isActive ? BotStatus.Active : BotStatus.Paused,
      trafficTypes: [TrafficType.PrivateMessages, TrafficType.GroupMessages],
      totalEarnings: '0.0000', // Would be calculated from actual orders
      todayEarnings: '0.0000',
      activeOrders: 0, // Would be calculated from actual orders
      lastActivity: source.updatedAt,
      createdAt: source.createdAt,
    };
  }

  // ======================================================
  // TRAFFIC PURCHASE METHODS (Traffic Targets - BUY SIDE)
  // ======================================================

  /**
   * Get available traffic types and prices
   */
  async getAvailableTraffic(_filters?: Record<string, unknown>): Promise<AvailableTrafficDto[]> {
    const activeSources = await this.trafficSourceRepository.findActive();

    // Aggregate available traffic by type
    const trafficMap = new Map<
      TrafficType,
      {
        totalAmount: number;
        minPrice: number;
        avgDeliveryTime: number;
      }
    >();

    // For now, return static data - in real implementation,
    // this would be calculated from active sources
    return [
      {
        trafficType: TrafficType.PrivateMessages,
        currentPrice: 0.05,
        availableAmount: 50000,
        estimatedDeliveryHours: 24,
      },
      {
        trafficType: TrafficType.GroupMessages,
        currentPrice: 0.03,
        availableAmount: 30000,
        estimatedDeliveryHours: 12,
      },
      {
        trafficType: TrafficType.ChannelSubscribers,
        currentPrice: 0.1,
        availableAmount: 10000,
        estimatedDeliveryHours: 48,
      },
      {
        trafficType: TrafficType.PostViews,
        currentPrice: 0.02,
        availableAmount: 100000,
        estimatedDeliveryHours: 6,
      },
    ];
  }

  /**
   * Create new traffic purchase order
   */
  async createTrafficOrder(dto: CreateTrafficOrderDto, userId: string): Promise<TrafficOrderResponseDto> {
    this.logger.log(`Creating traffic order for user ${userId}: ${dto.trafficType}`);

    return await this.em.transactional(async (_em) => {
      // Validate user exists
      const user = await this.userRepository.findOne({ id: userId });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Create or find traffic target
      let trafficTarget = await this.trafficTargetRepository.findByUsername(this.extractUsernameFromUrl(dto.targetUrl));

      if (!trafficTarget) {
        trafficTarget = await this.trafficTargetRepository.create({
          name: `Target for ${dto.targetUrl}`,
          description: dto.targetAudience,
          type: this.mapTrafficTypeToTargetType(dto.trafficType),
          username: this.extractUsernameFromUrl(dto.targetUrl),
          managedById: userId,
          pricePerMember: dto.pricePerUnit.toString(),
        });
      }

      // Find suitable traffic source
      const activeSources = await this.trafficSourceRepository.findActive();
      if (activeSources.length === 0) {
        throw new BadRequestException('No traffic sources available');
      }

      // For now, use the first available source
      const trafficSource = activeSources[0];

      // Generate order ID
      const orderId = await this.trafficOrderRepository.generateOrderId();

      // Calculate total cost
      const totalCost = dto.amount * dto.pricePerUnit;

      // Create traffic order
      const order = await this.trafficOrderRepository.create({
        orderId,
        type: this.mapTrafficTypeToOrderType(dto.trafficType),
        status: TrafficOrderStatus.Pending,
        targetCount: dto.amount,
        pricePerAction: dto.pricePerUnit.toString(),
        totalBudget: totalCost.toString(),
        description: dto.targetAudience,
        targetUrl: dto.targetUrl,
        requirements: {
          excludedThemes: dto.excludedThemes || [],
          targetAudience: dto.targetAudience,
        },
        creatorId: userId,
        trafficSourceId: trafficSource.id,
        trafficTargetId: trafficTarget.id,
        createdById: userId,
      });

      this.logger.log(`Traffic order created: ${order.orderId}`);

      return this.mapOrderToResponseDto(order, trafficTarget, trafficSource);
    });
  }

  /**
   * Get user's traffic orders
   */
  async getUserTrafficOrders(userId: string, _filters?: Record<string, unknown>): Promise<TrafficOrderResponseDto[]> {
    const orders = await this.trafficOrderRepository.findByCreator(userId);

    return Promise.all(
      orders.map(async (order) => {
        const target = await order.trafficTarget.load();
        const source = await order.trafficSource.load();

        return this.mapOrderToResponseDto(order, target, source);
      }),
    );
  }

  /**
   * Get specific traffic order details
   */
  async getTrafficOrder(orderId: string, userId: string): Promise<TrafficOrderResponseDto> {
    const order = await this.trafficOrderRepository.findByOrderId(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check access
    const hasAccess = await this.trafficOrderRepository.validateOrderAccess(orderId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    const target = await order.trafficTarget.load();
    const source = await order.trafficSource.load();

    return this.mapOrderToResponseDto(order, target, source);
  }

  /**
   * Update traffic order
   */
  async updateTrafficOrder(
    orderId: string,
    dto: UpdateTrafficOrderDto,
    userId: string,
  ): Promise<TrafficOrderResponseDto> {
    this.logger.log(`Updating traffic order: ${orderId}`);

    const order = await this.trafficOrderRepository.findByOrderId(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check access
    const hasAccess = await this.trafficOrderRepository.validateOrderAccess(orderId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    // Validate update permissions
    if (order.status === TrafficOrderStatus.Completed || order.status === TrafficOrderStatus.Cancelled) {
      throw new BadRequestException('Cannot update completed or cancelled order');
    }

    const updateData: Partial<TrafficOrderEntity> = {};

    if (dto.status) {
      updateData.status = dto.status as TrafficOrderStatus;
    }

    if (dto.amount && order.status === TrafficOrderStatus.Pending) {
      updateData.targetCount = dto.amount;
      updateData.totalBudget = (dto.amount * parseFloat(order.pricePerAction)).toString();
    }

    const updatedOrder = await this.trafficOrderRepository.update(order.id, updateData);

    const target = await updatedOrder.trafficTarget.load();
    const source = await updatedOrder.trafficSource.load();

    return this.mapOrderToResponseDto(updatedOrder, target, source);
  }

  /**
   * Cancel traffic order
   */
  async cancelTrafficOrder(orderId: string, userId: string): Promise<{ message: string }> {
    this.logger.log(`Cancelling traffic order: ${orderId}`);

    const order = await this.trafficOrderRepository.findByOrderId(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check access
    const hasAccess = await this.trafficOrderRepository.validateOrderAccess(orderId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    if (order.status === TrafficOrderStatus.Completed) {
      throw new BadRequestException('Cannot cancel completed order');
    }

    if (order.status === TrafficOrderStatus.Cancelled) {
      throw new BadRequestException('Order already cancelled');
    }

    await this.trafficOrderRepository.cancel(orderId);

    return { message: 'Order cancelled successfully' };
  }

  // =====================================
  // BOT TOKEN VALIDATION METHODS
  // =====================================

  /**
   * Validate bot token for traffic operations
   */
  async validateBotToken(dto: BotTokenValidationDto, clientIp?: string): Promise<BotTokenValidationResponseDto> {
    this.logger.log(`Validating bot token for operation: ${dto.operationContext}`);

    const result = await this.botTokenValidationService.validateToken(dto, clientIp);

    if (result.isErr()) {
      this.logger.warn('Bot token validation failed', {
        error: result.error.message,
        operationContext: dto.operationContext,
      });

      // Return unsuccessful validation response instead of throwing
      return {
        isValid: false,
        error: result.error.message,
      };
    }

    return result.value;
  }

  /**
   * Check if bot token is required for operation
   */
  isBotTokenRequired(operationContext: string): boolean {
    return this.botTokenValidationService.isTokenValidationRequired(operationContext);
  }

  /**
   * Get bot permissions for traffic operations
   */
  async getBotPermissions(botId: string): Promise<string[]> {
    try {
      return await this.botTokenValidationService.getBotPermissions(botId);
    } catch (error) {
      this.logger.error('Failed to get bot permissions', {
        botId,
        error: error instanceof Error ? error.message : String(error),
      });

      return [];
    }
  }

  /**
   * Invalidate bot token (for logout/security)
   */
  async invalidateBotToken(token: string): Promise<void> {
    this.logger.log('Invalidating bot token');

    try {
      await this.botTokenValidationService.invalidateToken(token);
      this.logger.debug('Bot token invalidated successfully');
    } catch (error) {
      this.logger.error('Failed to invalidate bot token', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - invalidation failure shouldn't break the flow
    }
  }

  // =====================================
  // PRIVATE HELPER METHODS
  // =====================================

  private extractUsernameFromUrl(url: string): string {
    // Extract username from Telegram URL or return the URL as is
    const match = url.match(/t\.me\/([^/?]+)/);

    return match ? `@${match[1]}` : url;
  }

  private mapTrafficTypeToTargetType(trafficType: TrafficType): TrafficTargetType {
    switch (trafficType) {
      case TrafficType.ChannelSubscribers:
        return TrafficTargetType.Channel;
      case TrafficType.GroupMessages:
        return TrafficTargetType.Group;
      case TrafficType.PrivateMessages:
        return TrafficTargetType.Bot;
      default:
        return TrafficTargetType.WithChecking;
    }
  }

  private mapTrafficTypeToOrderType(trafficType: TrafficType): TrafficOrderType {
    switch (trafficType) {
      case TrafficType.ChannelSubscribers:
        return TrafficOrderType.Subscribe;
      case TrafficType.GroupMessages:
        return TrafficOrderType.Join;
      case TrafficType.PostViews:
        return TrafficOrderType.View;
      default:
        return TrafficOrderType.Join;
    }
  }

  private mapOrderToResponseDto(
    order: TrafficOrderEntity,
    target: TrafficTargetEntity,
    source: TrafficSourceEntity,
  ): TrafficOrderResponseDto {
    const progressPercentage = order.targetCount > 0 ? Math.round((order.currentCount / order.targetCount) * 100) : 0;

    const estimatedCompletion = new Date();
    estimatedCompletion.setHours(estimatedCompletion.getHours() + 24); // Default 24h

    return {
      id: order.orderId,
      trafficType: this.mapOrderTypeToTrafficType(order.type),
      targetUrl: order.targetUrl || target.username || '',
      amount: order.targetCount,
      completedAmount: order.currentCount,
      pricePerUnit: parseFloat(order.pricePerAction),
      totalCost: parseFloat(order.totalBudget),
      status: order.status as OrderStatus,
      progressPercentage,
      estimatedCompletion,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private mapOrderTypeToTrafficType(orderType: TrafficOrderType): TrafficType {
    switch (orderType) {
      case TrafficOrderType.Subscribe:
        return TrafficType.ChannelSubscribers;
      case TrafficOrderType.View:
        return TrafficType.PostViews;
      case TrafficOrderType.Join:
        return TrafficType.GroupMessages;
      default:
        return TrafficType.PrivateMessages;
    }
  }
}
