import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsUUID, IsNumber, IsBoolean, Min, Max } from 'class-validator';

export enum TrafficQuality {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Premium = 'premium',
}

/**
 * Traffic source DTO representing a bot that provides traffic
 */
export class TrafficSourceDto {
  @ApiProperty({
    description: 'Traffic source (bot) ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  id!: string;

  @ApiProperty({
    description: 'User ID who manages this source',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  managedBy!: string;

  @ApiProperty({
    description: 'Bot username',
    example: '@my_traffic_bot',
  })
  @IsString()
  botUsername!: string;

  @ApiProperty({
    description: 'Traffic quality level',
    enum: TrafficQuality,
    example: TrafficQuality.High,
  })
  @IsEnum(TrafficQuality)
  quality!: TrafficQuality;

  @ApiProperty({
    description: 'Price per traffic unit',
    example: 0.05,
  })
  @IsNumber()
  @Min(0.01)
  pricePerUnit!: number;

  @ApiProperty({
    description: 'Available traffic amount',
    example: 10000,
  })
  @IsNumber()
  @Min(0)
  availableAmount!: number;

  @ApiProperty({
    description: 'Whether the source is currently active',
    example: true,
  })
  @IsBoolean()
  isActive!: boolean;

  @ApiPropertyOptional({
    description: 'Traffic category/niche',
    example: 'Tech & IT',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    description: 'Source creation timestamp',
    example: '2024-01-01T12:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Source last update timestamp',
    example: '2024-01-02T14:30:00Z',
  })
  updatedAt!: Date;
}

/**
 * Traffic source statistics DTO
 */
export class TrafficSourceStatsDto {
  @ApiProperty({
    description: 'Source (bot) ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  sourceId!: string;

  @ApiProperty({
    description: 'Total traffic sold',
    example: 25000,
  })
  @IsNumber()
  @Min(0)
  totalTrafficSold!: number;

  @ApiProperty({
    description: 'Active orders count',
    example: 5,
  })
  @IsNumber()
  @Min(0)
  activeOrders!: number;

  @ApiProperty({
    description: 'Completed orders count',
    example: 48,
  })
  @IsNumber()
  @Min(0)
  completedOrders!: number;

  @ApiProperty({
    description: 'Total earnings from this source',
    example: 1250.75,
  })
  @IsNumber()
  @Min(0)
  totalEarnings!: number;

  @ApiProperty({
    description: 'Average customer rating (0-5)',
    example: 4.7,
  })
  @IsNumber()
  @Min(0)
  @Max(5)
  averageRating!: number;

  @ApiProperty({
    description: 'Quality score (0-100)',
    example: 92,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityScore!: number;

  @ApiProperty({
    description: 'Statistics period',
    example: '7d',
  })
  @IsString()
  period!: string;
}

/**
 * Bot DTO representing a traffic source bot
 */
export class BotDto {
  @ApiProperty({
    description: 'Bot ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  id!: string;

  @ApiProperty({
    description: 'Bot username',
    example: '@my_traffic_bot',
  })
  @IsString()
  botUsername!: string;

  @ApiProperty({
    description: 'User ID who manages this bot',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  managedBy!: string;

  @ApiProperty({
    description: 'Whether the bot is active',
    example: true,
  })
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty({
    description: 'Bot creation timestamp',
    example: '2024-01-01T12:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Bot last update timestamp',
    example: '2024-01-02T14:30:00Z',
  })
  updatedAt!: Date;
}
