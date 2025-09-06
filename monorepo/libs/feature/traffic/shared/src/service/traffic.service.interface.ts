import {
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
} from '../dto';

export interface ITrafficService {
  // Bot management methods
  /**
   * Validate bot existence
   */
  validateBot(dto: BotValidationDto): Promise<{ exists: boolean; message: string }>;

  /**
   * Create bot for traffic sales
   */
  createBot(userId: string, dto: CreateBotDto): Promise<BotCreationResponseDto>;

  /**
   * Get bot settings
   */
  getBotSettings(userId: string, botId: string): Promise<BotSettingsDto>;

  /**
   * Update bot settings
   */
  updateBotSettings(userId: string, botId: string, dto: UpdateBotSettingsDto): Promise<BotSettingsDto>;

  /**
   * Perform bot action (start/pause/delete)
   */
  performBotAction(userId: string, botId: string, dto: BotActionDto): Promise<{ message: string }>;

  /**
   * Get all user bots
   */
  getUserBots(userId: string): Promise<BotResponseDto[]>;

  /**
   * Get specific bot details
   */
  getBotDetails(userId: string, botId: string): Promise<BotResponseDto>;

  // Traffic purchase methods
  /**
   * Get available traffic types and prices
   */
  getAvailableTraffic(): Promise<AvailableTrafficDto[]>;

  /**
   * Create new traffic purchase order
   */
  createTrafficOrder(userId: string, dto: CreateTrafficOrderDto): Promise<TrafficOrderResponseDto>;

  /**
   * Get user's traffic orders
   */
  getUserTrafficOrders(userId: string): Promise<TrafficOrderResponseDto[]>;

  /**
   * Get specific traffic order details
   */
  getTrafficOrder(userId: string, orderId: string): Promise<TrafficOrderResponseDto>;

  /**
   * Update traffic order
   */
  updateTrafficOrder(userId: string, orderId: string, dto: UpdateTrafficOrderDto): Promise<TrafficOrderResponseDto>;

  /**
   * Cancel traffic order
   */
  cancelTrafficOrder(userId: string, orderId: string): Promise<{ message: string }>;
}
