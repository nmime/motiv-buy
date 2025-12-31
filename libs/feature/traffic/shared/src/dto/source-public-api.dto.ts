import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * PUBLIC API DTOs for Traffic Source Integration
 * Minimal API: getTasks and checkTask only
 * API key is passed via X-API-Key header (not in request body)
 */

/**
 * Task DTO - represents an available order
 */
export class TaskDto {
  @ApiProperty({ description: 'Unique task signature (orderId-userId)', example: 'ORD-1234567890-USER-123456789' })
  taskId!: string;

  @ApiProperty({ description: 'Order ID', example: 'ORD-1234567890' })
  orderId!: string;

  @ApiProperty({
    description: 'Task action type',
    example: 'subscribe',
    enum: ['subscribe', 'join', 'view', 'react', 'comment', 'start'],
  })
  action!: string;

  @ApiProperty({ description: 'Reward amount (number)', example: 0.1 })
  price!: number;

  @ApiProperty({ description: 'Target link', example: 'https://t.me/mychannel' })
  link!: string;

  @ApiPropertyOptional({ description: 'Additional links', type: [String] })
  links?: string[];

  @ApiPropertyOptional({ description: 'Target name', example: 'My Crypto Channel' })
  name?: string;

  @ApiPropertyOptional({ description: 'Target username', example: '@mychannel' })
  username?: string;

  @ApiPropertyOptional({ description: 'Photo URL' })
  photo?: string;

  @ApiPropertyOptional({ description: 'Task description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Remaining slots', example: 95 })
  remainingSlots?: number;
}

/**
 * POST /source/tasks - Get available tasks for user
 * All targeting parameters for order matching
 */
export class GetTasksRequestDto {
  @ApiProperty({ description: 'User Telegram ID', example: 123456789 })
  @IsInt()
  @IsNotEmpty()
  userId!: number;

  @ApiPropertyOptional({ description: 'Maximum tasks to return (default: 5, max: 20)', example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  // ========================================
  // TARGETING PARAMETERS FOR ORDER MATCHING
  // ========================================

  @ApiPropertyOptional({ description: 'User gender for targeting', enum: ['male', 'female'] })
  @IsOptional()
  @IsString()
  gender?: 'male' | 'female';

  @ApiPropertyOptional({ description: 'User age for targeting', example: 25 })
  @IsOptional()
  @IsInt()
  @Min(13)
  @Max(100)
  age?: number;

  @ApiPropertyOptional({ description: 'User country code (ISO 3166-1 alpha-2)', example: 'US' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'User region/state code', example: 'CA' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ description: 'User city name', example: 'Los Angeles' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'User language code (ISO 639-1)', example: 'en' })
  @IsOptional()
  @IsString()
  language?: string;
}

export class GetTasksResponseDto {
  @ApiProperty({ description: 'Array of available tasks', type: [TaskDto] })
  tasks!: TaskDto[];

  @ApiProperty({ description: 'Total available tasks count', example: 15 })
  totalCount!: number;

  @ApiPropertyOptional({ description: 'Error message if any' })
  error?: string;
}

/**
 * POST /source/tasks/check - Check task completion status
 */
export class CheckTaskStatusRequestDto {
  @ApiProperty({ description: 'Task ID (signature)', example: 'ORD-1234567890-USER-123456789' })
  @IsString()
  @IsNotEmpty()
  taskId!: string;
}

export class CheckTaskStatusResponseDto {
  @ApiProperty({
    description: 'Task completion status',
    example: 'completed',
    enum: ['not_started', 'pending', 'completed', 'failed'],
  })
  status!: string;

  @ApiProperty({ description: 'Can submit completion', example: true })
  canSubmit!: boolean;

  @ApiPropertyOptional({ description: 'Completion timestamp (ISO 8601)' })
  completedAt?: string;

  @ApiPropertyOptional({ description: 'Error message' })
  error?: string;
}
