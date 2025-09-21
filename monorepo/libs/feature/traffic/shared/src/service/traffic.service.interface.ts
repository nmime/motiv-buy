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
  BotTokenValidationDto,
  BotTokenValidationResponseDto,
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
  createBot(dto: CreateBotDto, userId: string, botAuth?: unknown): Promise<BotCreationResponseDto>;

  /**
   * Get bot settings
   */
  getBotSettings(botId: string, userId: string): Promise<BotSettingsDto>;

  /**
   * Update bot settings
   */
  updateBotSettings(botId: string, dto: UpdateBotSettingsDto, userId: string): Promise<BotSettingsDto>;

  /**
   * Perform bot action (start/pause/delete)
   */
  performBotAction(botId: string, dto: BotActionDto, userId: string): Promise<{ message: string }>;

  /**
   * Get all user bots
   */
  getUserBots(userId: string, botAuth?: unknown): Promise<BotResponseDto[]>;

  /**
   * Get specific bot details
   */
  getBotDetails(botId: string, userId: string): Promise<BotResponseDto>;

  // Traffic purchase methods
  /**
   * Get available traffic types and prices
   */
  getAvailableTraffic(filters?: Record<string, unknown>): Promise<AvailableTrafficDto[]>;

  /**
   * Create new traffic purchase order
   */
  createTrafficOrder(dto: CreateTrafficOrderDto, userId: string): Promise<TrafficOrderResponseDto>;

  /**
   * Get user's traffic orders
   */
  getUserTrafficOrders(userId: string, filters?: Record<string, unknown>): Promise<TrafficOrderResponseDto[]>;

  /**
   * Get specific traffic order details
   */
  getTrafficOrder(orderId: string, userId: string): Promise<TrafficOrderResponseDto>;

  /**
   * Update traffic order
   */
  updateTrafficOrder(orderId: string, dto: UpdateTrafficOrderDto, userId: string): Promise<TrafficOrderResponseDto>;

  /**
   * Cancel traffic order
   */
  cancelTrafficOrder(orderId: string, userId: string): Promise<{ message: string }>;

  // Bot token validation methods
  /**
   * Validate bot token for traffic operations
   */
  validateBotToken(dto: BotTokenValidationDto, clientIp?: string): Promise<BotTokenValidationResponseDto>;

  /**
   * Check if bot token is required for operation
   */
  isBotTokenRequired(operationContext: string): boolean;

  /**
   * Get bot permissions for traffic operations
   */
  getBotPermissions(botId: string): Promise<string[]>;

  /**
   * Invalidate bot token (for logout/security)
   */
  invalidateBotToken(token: string): Promise<void>;
}
