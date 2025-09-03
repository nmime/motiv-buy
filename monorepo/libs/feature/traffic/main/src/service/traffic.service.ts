import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
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
  OrderStatus
} from '@libs/feature/traffic/shared';

/**
 * Service for managing traffic bots and traffic purchase orders
 */
@Injectable()
export class TrafficService implements ITrafficService {
  constructor(
    @InjectRepository(TrafficBuyer)
    private readonly botRepository: EntityRepository<TrafficBuyer>,
    @InjectRepository(TrafficOrder)
    private readonly trafficOrderRepository: EntityRepository<TrafficOrder>
  ) {}

  // Bot management methods

  /**
   * Validate bot existence with Traffy API
   */
  async validateBot(dto: BotValidationDto): Promise<{ exists: boolean; message: string }> {
    try {
      // Integration with Traffy API for bot validation
      const response = await fetch(`https://api.traffy.com/bots/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TRAFFY_API_KEY}`
        },
        body: JSON.stringify({ username: dto.username })
      });

      if (!response.ok) {
        return {
          exists: false,
          message: 'Ошибка при проверке бота через Traffy API'
        };
      }

      const data = await response.json();
      
      return {
        exists: data.exists,
        message: data.exists 
          ? 'Бот найден и готов к добавлению'
          : 'Бот не найден в системе Traffy'
      };
    } catch (error) {
      return {
        exists: false,
        message: 'Ошибка соединения с сервисом проверки ботов'
      };
    }
  }

  /**
   * Create new bot for traffic sales
   */
  async createBot(userId: string, dto: CreateBotDto): Promise<BotCreationResponseDto> {
    // Check if user already has a bot with this name
    const existingBot = await this.botRepository.findOne({
      where: { userId, name: dto.botUsername }
    });

    if (existingBot) {
      throw new BadRequestException('У вас уже есть бот с таким именем');
    }

    // Validate with Traffy API first
    const validation = await this.validateBot({ username: dto.botUsername });
    if (!validation.exists) {
      throw new BadRequestException(validation.message);
    }

    // Create bot entity
    const bot = this.botRepository.create({
      userId,
      name: dto.botUsername,
      traffyKey: dto.traffyKey,
      status: BotStatus.PENDING_MODERATION,
      trafficSold: 0,
      moneyEarned: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedBot = await this.botRepository.save(bot);

    // Submit for moderation
    await this._submitForModeration(savedBot.id, dto.traffyKey);

    return {
      botId: savedBot.id,
      status: BotStatus.PENDING_MODERATION,
      message: 'Бот создан и отправлен на модерацию. Вы получите уведомление о результатах проверки.',
      estimatedModerationTime: '24-48 часов'
    };
  }

  /**
   * Get bot settings
   */
  async getBotSettings(userId: string, botId: string): Promise<BotSettingsDto> {
    const bot = await this._findUserBot(userId, botId);
    const settings = await this._getBotSettings(botId);
    
    return {
      botId,
      enablePrivateMessages: settings.enablePrivateMessages,
      enableGroupMessages: settings.enableGroupMessages,
      enableChannelMessages: settings.enableChannelMessages,
      maxPartnersPerDay: settings.maxPartnersPerDay,
      timerBetweenActions: settings.timerBetweenActions,
      excludedThemes: settings.excludedThemes,
      isActive: settings.isActive
    };
  }

  /**
   * Update bot settings
   */
  async updateBotSettings(userId: string, botId: string, dto: UpdateBotSettingsDto): Promise<BotSettingsDto> {
    const bot = await this._findUserBot(userId, botId);
    
    if (bot.status !== BotStatus.ACTIVE) {
      throw new BadRequestException('Настройки можно изменять только для активных ботов');
    }

    if (dto.timerBetweenActions !== undefined && dto.timerBetweenActions < 30) {
      throw new BadRequestException('Таймер между действиями не может быть меньше 30 секунд');
    }

    if (dto.maxPartnersPerDay !== undefined && dto.maxPartnersPerDay > 100) {
      throw new BadRequestException('Максимальное количество партнеров в день не может превышать 100');
    }

    await this._updateBotSettings(botId, dto);
    return this.getBotSettings(userId, botId);
  }

  /**
   * Perform bot action (start/pause/delete)
   */
  async performBotAction(userId: string, botId: string, dto: BotActionDto): Promise<{ message: string }> {
    const bot = await this._findUserBot(userId, botId);

    switch (dto.action) {
      case BotAction.START:
        if (bot.status !== BotStatus.ACTIVE) {
          throw new BadRequestException('Можно запустить только активные боты');
        }
        await this._startBot(botId);
        return { message: 'Бот успешно запущен' };

      case BotAction.PAUSE:
        if (bot.status !== BotStatus.ACTIVE) {
          throw new BadRequestException('Можно приостановить только активные боты');
        }
        await this._pauseBot(botId);
        return { message: 'Бот приостановлен' };

      case BotAction.DELETE:
        await this._deleteBot(userId, botId);
        return { message: 'Бот удален' };

      default:
        throw new BadRequestException('Неизвестное действие');
    }
  }

  /**
   * Get all user bots
   */
  async getUserBots(userId: string): Promise<BotResponseDto[]> {
    const bots = await this.botRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' }
    });

    return bots.map(bot => ({
      id: bot.id,
      name: bot.name,
      trafficSold: bot.trafficSold,
      moneyEarned: bot.moneyEarned,
      status: bot.status,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt
    }));
  }

  /**
   * Get specific bot details
   */
  async getBotDetails(userId: string, botId: string): Promise<BotResponseDto> {
    const bot = await this._findUserBot(userId, botId);

    return {
      id: bot.id,
      name: bot.name,
      trafficSold: bot.trafficSold,
      moneyEarned: bot.moneyEarned,
      status: bot.status,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt
    };
  }

  // Traffic purchase methods

  /**
   * Get available traffic types and prices
   */
  async getAvailableTraffic(): Promise<AvailableTrafficDto[]> {
    // This would typically fetch from a database or external API
    return [
      {
        trafficType: TrafficType.PRIVATE_MESSAGES,
        currentPrice: 0.05,
        availableAmount: 50000,
        estimatedDeliveryHours: 24
      },
      {
        trafficType: TrafficType.GROUP_MESSAGES,
        currentPrice: 0.03,
        availableAmount: 100000,
        estimatedDeliveryHours: 48
      },
      {
        trafficType: TrafficType.CHANNEL_SUBSCRIBERS,
        currentPrice: 0.15,
        availableAmount: 20000,
        estimatedDeliveryHours: 72
      },
      {
        trafficType: TrafficType.POST_VIEWS,
        currentPrice: 0.01,
        availableAmount: 500000,
        estimatedDeliveryHours: 12
      }
    ];
  }

  /**
   * Create new traffic purchase order
   */
  async createTrafficOrder(userId: string, dto: CreateTrafficOrderDto): Promise<TrafficOrderResponseDto> {
    // Validate target URL format
    if (!this._isValidTelegramUrl(dto.targetUrl)) {
      throw new BadRequestException('Некорректный формат Telegram URL');
    }

    const totalCost = dto.amount * dto.pricePerUnit;
    
    // Check if user has sufficient balance (would integrate with balance service)
    // const hasBalance = await this.balanceService.checkBalance(userId, totalCost);
    // if (!hasBalance) {
    //   throw new BadRequestException('Недостаточно средств на балансе');
    // }

    const order = this.trafficOrderRepository.create({
      userId,
      trafficType: dto.trafficType,
      targetUrl: dto.targetUrl,
      amount: dto.amount,
      completedAmount: 0,
      pricePerUnit: dto.pricePerUnit,
      totalCost,
      status: OrderStatus.ACTIVE,
      targetAudience: dto.targetAudience,
      excludedThemes: dto.excludedThemes || [],
      progressPercentage: 0,
      estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedOrder = await this.trafficOrderRepository.save(order);

    // Deduct from balance
    // await this.balanceService.deductBalance(userId, totalCost);

    return this._mapToOrderResponse(savedOrder);
  }

  /**
   * Get user's traffic orders
   */
  async getUserTrafficOrders(userId: string): Promise<TrafficOrderResponseDto[]> {
    const orders = await this.trafficOrderRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' }
    });

    return orders.map(order => this._mapToOrderResponse(order));
  }

  /**
   * Get specific traffic order details
   */
  async getTrafficOrder(userId: string, orderId: string): Promise<TrafficOrderResponseDto> {
    const order = await this._findUserOrder(userId, orderId);
    return this._mapToOrderResponse(order);
  }

  /**
   * Update traffic order
   */
  async updateTrafficOrder(userId: string, orderId: string, dto: UpdateTrafficOrderDto): Promise<TrafficOrderResponseDto> {
    const order = await this._findUserOrder(userId, orderId);

    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Нельзя изменять завершенные или отмененные заказы');
    }

    if (dto.status !== undefined) {
      order.status = dto.status;
    }

    if (dto.amount !== undefined) {
      if (order.completedAmount > 0) {
        throw new BadRequestException('Нельзя изменить количество после начала выполнения заказа');
      }
      order.amount = dto.amount;
      order.totalCost = dto.amount * order.pricePerUnit;
    }

    order.updatedAt = new Date();
    const updatedOrder = await this.trafficOrderRepository.save(order);

    return this._mapToOrderResponse(updatedOrder);
  }

  /**
   * Cancel traffic order
   */
  async cancelTrafficOrder(userId: string, orderId: string): Promise<{ message: string }> {
    const order = await this._findUserOrder(userId, orderId);

    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Нельзя отменить завершенный заказ');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Заказ уже отменен');
    }

    order.status = OrderStatus.CANCELLED;
    order.updatedAt = new Date();
    await this.trafficOrderRepository.save(order);

    // Refund remaining amount to balance
    const refundAmount = (order.amount - order.completedAmount) * order.pricePerUnit;
    if (refundAmount > 0) {
      // await this.balanceService.addBalance(userId, refundAmount);
    }

    return { message: 'Заказ отменен, неиспользованные средства возвращены на баланс' };
  }

  // Private helper methods

  private async _findUserBot(userId: string, botId: string) {
    const bot = await this.botRepository.findOne({
      where: { id: botId, userId }
    });

    if (!bot) {
      throw new NotFoundException('Бот не найден');
    }

    return bot;
  }

  private async _findUserOrder(userId: string, orderId: string) {
    const order = await this.trafficOrderRepository.findOne({
      where: { id: orderId, userId }
    });

    if (!order) {
      throw new NotFoundException('Заказ не найден');
    }

    return order;
  }

  private async _getBotSettings(botId: string) {
    // Implementation would fetch from bot_settings table
    return {
      enablePrivateMessages: true,
      enableGroupMessages: true,
      enableChannelMessages: false,
      maxPartnersPerDay: 10,
      timerBetweenActions: 60,
      excludedThemes: [],
      isActive: false
    };
  }

  private async _updateBotSettings(botId: string, settings: UpdateBotSettingsDto) {
    // Implementation would update bot_settings table
  }

  private async _submitForModeration(botId: string, traffyKey: string) {
    // Implementation would integrate with moderation system
  }

  private async _startBot(botId: string) {
    // Implementation would start bot operations
  }

  private async _pauseBot(botId: string) {
    // Implementation would pause bot operations
  }

  private async _deleteBot(userId: string, botId: string) {
    await this.botRepository.delete({ id: botId, userId });
  }

  private _isValidTelegramUrl(url: string): boolean {
    const telegramUrlPattern = /^https:\/\/t\.me\/[a-zA-Z0-9_]+$/;
    return telegramUrlPattern.test(url);
  }

  private _mapToOrderResponse(order: TrafficOrder): TrafficOrderResponseDto {
    return {
      id: order.id,
      trafficType: order.trafficType,
      targetUrl: order.targetUrl,
      amount: order.amount,
      completedAmount: order.completedAmount,
      pricePerUnit: order.pricePerUnit,
      totalCost: order.totalCost,
      status: order.status,
      progressPercentage: order.progressPercentage,
      estimatedCompletion: order.estimatedCompletion,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  }
}

// Import actual entities from database lib
import { TrafficBuyerEntity as TrafficBuyer, TrafficOrderEntity as TrafficOrder } from '@app/database';
