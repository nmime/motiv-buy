import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * PUBLIC API DTOs for Traffic Source Task operations
 * Similar to FlyerService/SubGram task API
 */

/**
 * Task action types
 */
export enum TaskAction {
  Subscribe = 'subscribe',
  Join = 'join',
  View = 'view',
  React = 'react',
  Comment = 'comment',
}

/**
 * Task target details
 */
export class TaskTargetDto {
  @ApiProperty({ description: 'Target type (channel, group, bot)', example: 'channel' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ description: 'Target username', example: '@mychannel' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ description: 'Target invite link or URL', example: 'https://t.me/mychannel' })
  @IsString()
  @IsNotEmpty()
  link!: string;

  @ApiPropertyOptional({ description: 'Target name', example: 'My Channel' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Telegram ID', example: '-1001234567890' })
  @IsOptional()
  @IsString()
  telegramId?: string;
}

/**
 * Task targeting requirements
 */
export class TaskRequirementsDto {
  @ApiPropertyOptional({ description: 'Minimum age', example: 18 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minAge?: number;

  @ApiPropertyOptional({ description: 'Maximum age', example: 65 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAge?: number;

  @ApiPropertyOptional({ description: 'Required gender', example: 'male', enum: ['male', 'female'] })
  @IsOptional()
  @IsString()
  gender?: 'male' | 'female';

  @ApiPropertyOptional({ description: 'Allowed country codes', example: ['US', 'GB'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @ApiPropertyOptional({ description: 'Required language codes', example: ['en', 'ru'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];
}

/**
 * Single task DTO
 */
export class TaskDto {
  @ApiProperty({ description: 'Task ID', example: 'ORD-1234567890' })
  @IsString()
  @IsNotEmpty()
  taskId!: string;

  @ApiProperty({ description: 'Task action type', enum: TaskAction, example: 'subscribe' })
  @IsEnum(TaskAction)
  action!: TaskAction;

  @ApiProperty({ description: 'Target details', type: TaskTargetDto })
  @ValidateNested()
  @Type(() => TaskTargetDto)
  target!: TaskTargetDto;

  @ApiProperty({ description: 'Reward per completion (decimal string)', example: '0.10' })
  @IsString()
  @IsNotEmpty()
  reward!: string;

  @ApiPropertyOptional({ description: 'Task requirements', type: TaskRequirementsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TaskRequirementsDto)
  requirements?: TaskRequirementsDto;

  @ApiPropertyOptional({ description: 'Task description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Remaining slots', example: 100 })
  @IsOptional()
  @IsNumber()
  remainingSlots?: number;
}

/**
 * Get available tasks request (query parameters)
 */
export class GetTasksRequestDto {
  @ApiPropertyOptional({ description: 'User Telegram ID', example: 123456789 })
  @IsOptional()
  @IsNumber()
  userId?: number;

  @ApiPropertyOptional({ description: 'User language code', example: 'en' })
  @IsOptional()
  @IsString()
  languageCode?: string;

  @ApiPropertyOptional({ description: 'User gender', enum: ['male', 'female'] })
  @IsOptional()
  @IsString()
  gender?: 'male' | 'female';

  @ApiPropertyOptional({ description: 'User age', example: 25 })
  @IsOptional()
  @IsNumber()
  age?: number;

  @ApiPropertyOptional({ description: 'User country code', example: 'US' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Maximum number of tasks to return', example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}

/**
 * Get tasks response
 */
export class GetTasksResponseDto {
  @ApiProperty({ description: 'Available tasks', type: [TaskDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskDto)
  tasks!: TaskDto[];

  @ApiProperty({ description: 'Total count of available tasks', example: 25 })
  @IsNumber()
  total!: number;

  @ApiPropertyOptional({ description: 'Message for empty results' })
  @IsOptional()
  @IsString()
  message?: string;
}

/**
 * Complete task request
 */
export class CompleteTaskRequestDto {
  @ApiProperty({ description: 'User Telegram ID who completed the task', example: 123456789 })
  @IsNumber()
  @IsNotEmpty()
  userId!: number;

  @ApiPropertyOptional({ description: 'User Telegram username', example: '@username' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Completion timestamp (ISO 8601)', example: '2025-01-06T12:00:00Z' })
  @IsOptional()
  @IsString()
  completedAt?: string;

  @ApiPropertyOptional({ description: 'Proof of completion (screenshot URL, metadata)' })
  @IsOptional()
  proof?: {
    screenshotUrl?: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Complete task response
 */
export class CompleteTaskResponseDto {
  @ApiProperty({ description: 'Whether completion was successful', example: true })
  success!: boolean;

  @ApiPropertyOptional({ description: 'Action/completion ID', example: 'ACT-1234567890' })
  @IsOptional()
  @IsString()
  actionId?: string;

  @ApiPropertyOptional({
    description: 'Completion status',
    example: 'verified',
    enum: ['verified', 'pending', 'rejected'],
  })
  @IsOptional()
  @IsString()
  status?: 'verified' | 'pending' | 'rejected';

  @ApiPropertyOptional({ description: 'Reward amount (decimal string)', example: '0.10' })
  @IsOptional()
  @IsString()
  reward?: string;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional({ description: 'Additional message' })
  @IsOptional()
  @IsString()
  message?: string;
}

/**
 * Check task status request (query parameters)
 */
export class CheckTaskStatusRequestDto {
  @ApiProperty({ description: 'User Telegram ID', example: 123456789 })
  @IsNumber()
  @IsNotEmpty()
  userId!: number;
}

/**
 * Check task status response
 */
export class CheckTaskStatusResponseDto {
  @ApiProperty({ description: 'Task ID', example: 'ORD-1234567890' })
  @IsString()
  @IsNotEmpty()
  taskId!: string;

  @ApiProperty({ description: 'Completion status', example: 'completed' })
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiProperty({ description: 'Whether user can proceed with submission', example: true })
  canSubmit!: boolean;

  @ApiPropertyOptional({ description: 'Message with details' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Completed timestamp (ISO 8601)' })
  @IsOptional()
  @IsString()
  completedAt?: string;
}

/**
 * Filter options response (PUBLIC - no auth)
 */
export class GetFiltersResponseDto {
  @ApiProperty({ description: 'Available genders', example: ['male', 'female'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  genders!: string[];

  @ApiProperty({
    description: 'Available age ranges',
    type: 'array',
    example: [
      { label: '18-24', min: 18, max: 24 },
      { label: '25-34', min: 25, max: 34 },
    ],
  })
  @IsArray()
  ageRanges!: Array<{ label: string; min: number; max: number }>;

  @ApiProperty({
    description: 'Available countries',
    type: 'array',
    example: [
      { code: 'US', name: 'United States' },
      { code: 'GB', name: 'United Kingdom' },
    ],
  })
  @IsArray()
  countries!: Array<{ code: string; name: string }>;

  @ApiProperty({
    description: 'Available languages',
    type: 'array',
    example: [
      { code: 'en', name: 'English' },
      { code: 'ru', name: 'Russian' },
    ],
  })
  @IsArray()
  languages!: Array<{ code: string; name: string }>;

  @ApiProperty({
    description: 'Available task types with base prices',
    type: 'array',
    example: [
      { type: 'subscribe', displayName: 'Channel Subscribe', basePrice: '0.10' },
      { type: 'join', displayName: 'Group Join', basePrice: '0.08' },
    ],
  })
  @IsArray()
  taskTypes!: Array<{ type: string; displayName: string; basePrice: string }>;
}
