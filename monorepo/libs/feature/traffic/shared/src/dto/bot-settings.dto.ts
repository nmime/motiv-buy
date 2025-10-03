import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsArray, IsOptional, Min, Max, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Price Settings
 */
export class PriceSettings {
  @ApiProperty({
    description: 'Base price per unit',
    example: 0.05,
  })
  @IsNumber()
  @Min(0.01)
  basePrice!: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  @IsString()
  currency!: string;
}

/**
 * Daily Limits
 */
export class DailyLimits {
  @ApiProperty({
    description: 'Maximum orders per day',
    example: 100,
  })
  @IsNumber()
  @Min(1)
  maxOrders!: number;

  @ApiProperty({
    description: 'Maximum amount per day',
    example: 10000,
  })
  @IsNumber()
  @Min(1)
  maxAmount!: number;
}

export class BotSettingsDto {
  @ApiProperty({
    description: 'Bot ID',
    example: 'uuid-bot-id',
  })
  botId!: string;

  @ApiProperty({
    description: 'Bot username',
    example: '@my_traffic_bot',
  })
  @IsString()
  botUsername!: string;

  @ApiProperty({
    description: 'Enable private messages',
    example: true,
  })
  enablePrivateMessages!: boolean;

  @ApiProperty({
    description: 'Enable group messages',
    example: true,
  })
  enableGroupMessages!: boolean;

  @ApiProperty({
    description: 'Enable channel messages',
    example: false,
  })
  enableChannelMessages!: boolean;

  @ApiProperty({
    description: 'Maximum partners per day',
    example: 10,
  })
  maxPartnersPerDay!: number;

  @ApiProperty({
    description: 'Timer between actions in seconds',
    example: 60,
  })
  timerBetweenActions!: number;

  @ApiProperty({
    description: 'Excluded themes',
    example: ['adult', 'gambling'],
    type: [String],
  })
  excludedThemes!: string[];

  @ApiProperty({
    description: 'Bot active status',
    example: true,
  })
  isActive!: boolean;

  @ApiPropertyOptional({
    description: 'Price settings for the bot',
    type: PriceSettings,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PriceSettings)
  priceSettings?: PriceSettings;

  @ApiPropertyOptional({
    description: 'Daily limits for the bot',
    type: DailyLimits,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DailyLimits)
  dailyLimits?: DailyLimits;
}

export class UpdateBotSettingsDto {
  @ApiProperty({
    description: 'Enable private messages',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  enablePrivateMessages?: boolean;

  @ApiProperty({
    description: 'Enable group messages',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  enableGroupMessages?: boolean;

  @ApiProperty({
    description: 'Enable channel messages',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  enableChannelMessages?: boolean;

  @ApiProperty({
    description: 'Maximum partners per day',
    example: 15,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxPartnersPerDay?: number;

  @ApiProperty({
    description: 'Timer between actions in seconds',
    example: 90,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(3600)
  timerBetweenActions?: number;

  @ApiProperty({
    description: 'Excluded themes',
    example: ['adult', 'gambling', 'crypto'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  excludedThemes?: string[];

  @ApiProperty({
    description: 'Bot active status',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Price settings for the bot',
    type: PriceSettings,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PriceSettings)
  priceSettings?: PriceSettings;

  @ApiPropertyOptional({
    description: 'Daily limits for the bot',
    type: DailyLimits,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DailyLimits)
  dailyLimits?: DailyLimits;
}
