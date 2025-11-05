export * from './bot-creation.dto';
export * from './bot-token-validation.dto';
export * from './traffic-target.dto';
export * from './source-bot.dto';

// Export bot token validation result
export { BotTokenValidationResponseDto as BotTokenValidationResultDto } from './bot-token-validation.dto';

// Export bot management DTOs (explicit to avoid duplicates)
export { BotStatus, BotAction, BotActionDto, BotResponseDto } from './bot-management.dto';

// Export bot settings DTOs (explicit to avoid duplicates)
export { PriceSettings, DailyLimits, BotSettingsDto, UpdateBotSettingsDto } from './bot-settings.dto';

// Export traffic source DTOs (excluding duplicates that exist in bot-management and bot-settings)
export { TrafficQuality, TrafficSourceDto, TrafficSourceStatsDto, BotDto } from './traffic-source.dto';

// Export traffic order DTOs from traffic-order.dto (primary source)
export { TrafficOrderDto, TrafficOrderStatusDto, TrafficOrderStatsDto } from './traffic-order.dto';

// Export additional DTOs from traffic-purchase.dto (excluding duplicates)
export {
  CreateTrafficOrderDto,
  TrafficOrderResponseDto,
  UpdateTrafficOrderDto,
  AvailableTrafficDto,
  TrafficType,
  TrafficOrderStatus,
  type OrderStatus,
} from './traffic-purchase.dto';
