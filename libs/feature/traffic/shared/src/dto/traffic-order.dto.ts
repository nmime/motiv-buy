import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { TrafficOrderStatus } from '@app/database';

/**
 * Traffic order DTO representing a traffic purchase order
 */
export class TrafficOrderDto {
  @ApiProperty({
    description: 'Order ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  id!: string;

  @ApiProperty({
    description: 'Traffic target ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  targetId!: string;

  @ApiProperty({
    description: 'User ID who created the order',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    description: 'Order status',
    enum: TrafficOrderStatus,
    example: TrafficOrderStatus.Active,
  })
  @IsEnum(TrafficOrderStatus)
  status!: TrafficOrderStatus;

  @ApiProperty({
    description: 'Ordered traffic amount',
    example: 1000,
  })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty({
    description: 'Completed traffic amount',
    example: 750,
  })
  @IsNumber()
  @Min(0)
  completedAmount!: number;

  @ApiProperty({
    description: 'Price per unit of traffic',
    example: 0.05,
  })
  @IsNumber()
  @Min(0.01)
  pricePerUnit!: number;

  @ApiProperty({
    description: 'Total order cost',
    example: 50.0,
  })
  @IsNumber()
  @Min(0)
  totalCost!: number;

  @ApiProperty({
    description: 'Order creation timestamp',
    example: '2024-01-01T12:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Order last update timestamp',
    example: '2024-01-02T14:30:00Z',
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'Estimated completion timestamp',
    example: '2024-01-05T18:00:00Z',
  })
  @IsOptional()
  estimatedCompletionAt?: Date;
}

/**
 * Traffic order status update DTO
 */
export class TrafficOrderStatusDto {
  @ApiProperty({
    description: 'New order status',
    enum: TrafficOrderStatus,
    example: TrafficOrderStatus.Paused,
  })
  @IsEnum(TrafficOrderStatus)
  status!: TrafficOrderStatus;

  @ApiPropertyOptional({
    description: 'Reason for status change',
    example: 'Paused due to budget constraints',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Traffic order statistics DTO
 */
export class TrafficOrderStatsDto {
  @ApiProperty({
    description: 'Order ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  orderId!: string;

  @ApiProperty({
    description: 'Total ordered amount',
    example: 1000,
  })
  @IsNumber()
  totalOrdered!: number;

  @ApiProperty({
    description: 'Completed amount',
    example: 750,
  })
  @IsNumber()
  completed!: number;

  @ApiProperty({
    description: 'Pending amount',
    example: 250,
  })
  @IsNumber()
  pending!: number;

  @ApiProperty({
    description: 'Progress percentage (0-100)',
    example: 75,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercentage!: number;

  @ApiProperty({
    description: 'Average delivery rate (units per hour)',
    example: 31.25,
  })
  @IsNumber()
  averageRate!: number;

  @ApiProperty({
    description: 'Total cost spent so far',
    example: 37.5,
  })
  @IsNumber()
  totalSpent!: number;

  @ApiProperty({
    description: 'Estimated remaining cost',
    example: 12.5,
  })
  @IsNumber()
  estimatedRemaining!: number;
}
