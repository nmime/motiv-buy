import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsArray, Min, Max } from 'class-validator';

export enum TrafficType {
  PRIVATE_MESSAGES = 'private_messages',
  GROUP_MESSAGES = 'group_messages',
  CHANNEL_SUBSCRIBERS = 'channel_subscribers',
  POST_VIEWS = 'post_views',
}

export enum OrderStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export class CreateTrafficOrderDto {
  @ApiProperty({
    description: 'Traffic type',
    enum: TrafficType,
    example: TrafficType.PRIVATE_MESSAGES,
  })
  @IsEnum(TrafficType)
  trafficType!: TrafficType;

  @ApiProperty({
    description: 'Target URL or username',
    example: 'https://t.me/channel_name',
  })
  @IsString()
  targetUrl!: string;

  @ApiProperty({
    description: 'Amount of traffic to purchase',
    example: 1000,
  })
  @IsNumber()
  @Min(100)
  @Max(100000)
  amount!: number;

  @ApiProperty({
    description: 'Price per unit',
    example: 0.05,
  })
  @IsNumber()
  @Min(0.01)
  pricePerUnit!: number;

  @ApiProperty({
    description: 'Target audience description',
    example: 'IT specialists 25-40 years old',
    required: false,
  })
  @IsOptional()
  @IsString()
  targetAudience?: string;

  @ApiProperty({
    description: 'Excluded themes',
    example: ['adult', 'gambling'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  excludedThemes?: string[];
}

export class TrafficOrderResponseDto {
  @ApiProperty({
    description: 'Order ID',
    example: 'uuid-order-id',
  })
  id!: string;

  @ApiProperty({
    description: 'Traffic type',
    enum: TrafficType,
    example: TrafficType.PRIVATE_MESSAGES,
  })
  trafficType!: TrafficType;

  @ApiProperty({
    description: 'Target URL',
    example: 'https://t.me/channel_name',
  })
  targetUrl!: string;

  @ApiProperty({
    description: 'Ordered amount',
    example: 1000,
  })
  amount!: number;

  @ApiProperty({
    description: 'Completed amount',
    example: 750,
  })
  completedAmount!: number;

  @ApiProperty({
    description: 'Price per unit',
    example: 0.05,
  })
  pricePerUnit!: number;

  @ApiProperty({
    description: 'Total cost',
    example: 50.0,
  })
  totalCost!: number;

  @ApiProperty({
    description: 'Order status',
    enum: OrderStatus,
    example: OrderStatus.ACTIVE,
  })
  status!: OrderStatus;

  @ApiProperty({
    description: 'Progress percentage',
    example: 75,
  })
  progressPercentage!: number;

  @ApiProperty({
    description: 'Estimated completion time',
    example: '2024-09-01T12:00:00Z',
  })
  estimatedCompletion!: Date;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-08-31T14:26:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Last update date',
    example: '2024-08-31T14:30:00Z',
  })
  updatedAt!: Date;
}

export class UpdateTrafficOrderDto {
  @ApiProperty({
    description: 'New order status',
    enum: OrderStatus,
    example: OrderStatus.PAUSED,
    required: false,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiProperty({
    description: 'Update amount if not started',
    example: 1500,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(100000)
  amount?: number;
}

export class AvailableTrafficDto {
  @ApiProperty({
    description: 'Available traffic type',
    enum: TrafficType,
    example: TrafficType.PRIVATE_MESSAGES,
  })
  trafficType!: TrafficType;

  @ApiProperty({
    description: 'Current price per unit',
    example: 0.05,
  })
  currentPrice!: number;

  @ApiProperty({
    description: 'Available amount',
    example: 50000,
  })
  availableAmount!: number;

  @ApiProperty({
    description: 'Estimated delivery time in hours',
    example: 24,
  })
  estimatedDeliveryHours!: number;
}
