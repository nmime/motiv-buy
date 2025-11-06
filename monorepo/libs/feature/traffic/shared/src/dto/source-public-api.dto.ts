import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * PUBLIC API DTOs for Traffic Source
 * All endpoints use POST with apiKey in request body (SubGram/FlyerService pattern)
 * Using our naming conventions (camelCase, TrafficSource/Order terminology)
 */

/**
 * Base request with API key
 */
export class BaseSourceRequestDto {
  @ApiProperty({ description: 'Traffic source API key', example: 'sk_live_abc123def456...' })
  @IsString()
  @IsNotEmpty()
  apiKey!: string;
}

/**
 * POST /source/info - Get traffic source information
 * Our version of SubGram's /get_me
 */
export class GetSourceInfoRequestDto extends BaseSourceRequestDto {}

export class GetSourceInfoResponseDto {
  @ApiProperty({ description: 'Source ID', example: '01234567-89ab-cdef-0123-456789abcdef' })
  sourceId!: string;

  @ApiProperty({ description: 'Source type', example: 'bot_with_token' })
  sourceType!: string;

  @ApiProperty({ description: 'Bot Telegram ID', example: 123456 })
  botId?: number;

  @ApiProperty({ description: 'Bot username', example: '@mytrafficbot' })
  botUsername?: string;

  @ApiProperty({ description: 'Source is active', example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ description: 'Error message if validation failed' })
  error?: string;
}

/**
 * POST /source/check-subscription - Check mandatory subscription status
 * Our version of SubGram's /check
 */
export class CheckSubscriptionRequestDto extends BaseSourceRequestDto {
  @ApiProperty({ description: 'User Telegram ID', example: 123456789 })
  @IsInt()
  @IsNotEmpty()
  userId!: number;

  @ApiPropertyOptional({ description: 'User language code', example: 'en' })
  @IsOptional()
  @IsString()
  languageCode?: string;
}

export class CheckSubscriptionResponseDto {
  @ApiProperty({ description: 'Whether to skip mandatory subscription check', example: false })
  skipCheck!: boolean;

  @ApiPropertyOptional({ description: 'Error message' })
  error?: string;

  @ApiPropertyOptional({ description: 'Warning message' })
  warning?: string;

  @ApiPropertyOptional({ description: 'Info message' })
  info?: string;
}

/**
 * Task DTO - represents an available order
 */
export class TaskDto {
  @ApiProperty({ description: 'Unique task signature (orderId-userId)', example: 'ORD-1234567890-USER-123456789' })
  taskId!: string;

  @ApiProperty({ description: 'Order ID', example: 'ORD-1234567890' })
  orderId!: string;

  @ApiProperty({ description: 'Task action type', example: 'subscribe', enum: ['subscribe', 'join', 'view', 'react', 'comment'] })
  action!: string;

  @ApiProperty({ description: 'Reward amount (number)', example: 0.10 })
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
 * Our version of SubGram's /get_tasks
 */
export class GetTasksRequestDto extends BaseSourceRequestDto {
  @ApiProperty({ description: 'User Telegram ID', example: 123456789 })
  @IsInt()
  @IsNotEmpty()
  userId!: number;

  @ApiPropertyOptional({ description: 'User language code', example: 'en' })
  @IsOptional()
  @IsString()
  languageCode?: string;

  @ApiPropertyOptional({ description: 'Maximum tasks to return (default: 5, max: 20)', example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

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

  @ApiPropertyOptional({ description: 'User country code for targeting', example: 'US' })
  @IsOptional()
  @IsString()
  country?: string;
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
 * Our version of SubGram's /check_task
 */
export class CheckTaskStatusRequestDto extends BaseSourceRequestDto {
  @ApiProperty({ description: 'Task ID (signature)', example: 'ORD-1234567890-USER-123456789' })
  @IsString()
  @IsNotEmpty()
  taskId!: string;
}

export class CheckTaskStatusResponseDto {
  @ApiProperty({ description: 'Task completion status', example: 'completed', enum: ['not_started', 'pending', 'completed', 'failed'] })
  status!: string;

  @ApiProperty({ description: 'Can submit completion', example: true })
  canSubmit!: boolean;

  @ApiPropertyOptional({ description: 'Completion timestamp (ISO 8601)' })
  completedAt?: string;

  @ApiPropertyOptional({ description: 'Error message' })
  error?: string;
}

/**
 * POST /source/tasks/completed - Get user's completed tasks
 * Our version of SubGram's /get_completed_tasks
 */
export class GetCompletedTasksRequestDto extends BaseSourceRequestDto {
  @ApiProperty({ description: 'User Telegram ID', example: 123456789 })
  @IsInt()
  @IsNotEmpty()
  userId!: number;
}

export class CompletedTaskDto {
  @ApiProperty({ description: 'Task ID', example: 'ORD-1234567890-USER-123456789' })
  taskId!: string;

  @ApiProperty({ description: 'Order ID', example: 'ORD-1234567890' })
  orderId!: string;

  @ApiProperty({ description: 'Reward earned', example: 0.10 })
  reward!: number;

  @ApiProperty({ description: 'Completed at (ISO 8601)', example: '2025-01-06T12:00:00Z' })
  completedAt!: string;
}

export class GetCompletedTasksResponseDto {
  @ApiProperty({ description: 'Array of completed tasks', type: [CompletedTaskDto] })
  completedTasks!: CompletedTaskDto[];

  @ApiProperty({ description: 'Total completed tasks count', example: 42 })
  totalCount!: number;

  @ApiPropertyOptional({ description: 'Error message' })
  error?: string;
}

/**
 * POST /source/tasks/complete - Submit task completion
 * FlyerService pattern with our naming
 */
export class CompleteTaskRequestDto extends BaseSourceRequestDto {
  @ApiProperty({ description: 'Task ID to complete', example: 'ORD-1234567890-USER-123456789' })
  @IsString()
  @IsNotEmpty()
  taskId!: string;

  @ApiProperty({ description: 'User Telegram ID', example: 123456789 })
  @IsInt()
  @IsNotEmpty()
  userId!: number;

  @ApiPropertyOptional({ description: 'User Telegram username', example: '@john' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Completion timestamp (ISO 8601)', example: '2025-01-06T12:00:00Z' })
  @IsOptional()
  @IsString()
  completedAt?: string;

  @ApiPropertyOptional({ description: 'Proof data (screenshot URL, metadata)' })
  @IsOptional()
  proof?: {
    screenshotUrl?: string;
    metadata?: Record<string, unknown>;
  };
}

export class CompleteTaskResponseDto {
  @ApiProperty({ description: 'Whether completion was successful', example: true })
  success!: boolean;

  @ApiPropertyOptional({ description: 'Action ID if successful', example: 'ACT-1234567890' })
  actionId?: string;

  @ApiPropertyOptional({ description: 'Completion status', example: 'verified', enum: ['verified', 'pending', 'rejected'] })
  status?: 'verified' | 'pending' | 'rejected';

  @ApiPropertyOptional({ description: 'Reward amount earned', example: 0.10 })
  reward?: number;

  @ApiPropertyOptional({ description: 'User total earnings after this task', example: 5.50 })
  totalEarnings?: number;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  error?: string;

  @ApiPropertyOptional({ description: 'Additional message' })
  message?: string;
}

/**
 * GET /source/filters - Get available targeting filters (PUBLIC - no auth)
 */
export class GetFiltersResponseDto {
  @ApiProperty({ description: 'Available genders', example: ['male', 'female'], type: [String] })
  genders!: string[];

  @ApiProperty({
    description: 'Available age ranges',
    type: 'array',
    example: [
      { label: '18-24', min: 18, max: 24 },
      { label: '25-34', min: 25, max: 34 },
    ],
  })
  ageRanges!: Array<{ label: string; min: number; max: number }>;

  @ApiProperty({
    description: 'Available countries',
    type: 'array',
    example: [
      { code: 'US', name: 'United States' },
      { code: 'GB', name: 'United Kingdom' },
    ],
  })
  countries!: Array<{ code: string; name: string }>;

  @ApiProperty({
    description: 'Available languages',
    type: 'array',
    example: [
      { code: 'en', name: 'English' },
      { code: 'ru', name: 'Russian' },
    ],
  })
  languages!: Array<{ code: string; name: string }>;

  @ApiProperty({
    description: 'Available action types with base prices',
    type: 'array',
    example: [
      { action: 'subscribe', displayName: 'Channel Subscribe', basePrice: 0.10 },
      { action: 'join', displayName: 'Group Join', basePrice: 0.08 },
    ],
  })
  actions!: Array<{ action: string; displayName: string; basePrice: number }>;
}
