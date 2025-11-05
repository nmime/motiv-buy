import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * PUBLIC ENDPOINT DTOs (No authentication required)
 */

/**
 * Available targeting filters
 */
export class GetFiltersResponseDto {
  @ApiProperty({ type: [String], example: ['male', 'female'] })
  @IsArray()
  @IsString({ each: true })
  genders!: string[];

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        min: { type: 'number' },
        max: { type: 'number' },
      },
    },
    example: [
      { label: '18-24', min: 18, max: 24 },
      { label: '25-34', min: 25, max: 34 },
    ],
  })
  @IsArray()
  ageRanges!: Array<{ label: string; min: number; max: number }>;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        name: { type: 'string' },
      },
    },
    example: [
      { code: 'US', name: 'United States' },
      { code: 'UK', name: 'United Kingdom' },
    ],
  })
  @IsArray()
  countries!: Array<{ code: string; name: string }>;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        name: { type: 'string' },
      },
    },
    example: [
      { code: 'en', name: 'English' },
      { code: 'ru', name: 'Russian' },
    ],
  })
  @IsArray()
  languages!: Array<{ code: string; name: string }>;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        displayName: { type: 'string' },
        basePrice: { type: 'string' },
      },
    },
  })
  @IsArray()
  trafficTypes!: Array<{
    type: string;
    displayName: string;
    basePrice: string;
  }>;
}

/**
 * PRIVATE ENDPOINT DTOs (Bot token authentication required)
 */

/**
 * Register bot request
 */
export class RegisterBotRequestDto {
  @ApiProperty({
    description: 'Telegram bot token',
    example: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
  })
  @IsString()
  key!: string;

  @ApiProperty({
    description: 'Bot name',
    example: 'My Traffic Bot',
  })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: 'Bot description',
    example: 'Bot for task completion and earnings',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Bot categories',
    type: [String],
    example: ['crypto', 'tech'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];
}

/**
 * Register bot response
 */
export class RegisterBotResponseDto {
  @ApiProperty({ description: 'Traffic source ID' })
  @IsString()
  sourceId!: string;

  @ApiProperty({ description: 'Bot username', example: '@my_traffic_bot' })
  @IsString()
  botUsername!: string;

  @ApiPropertyOptional({ description: 'Telegram bot ID' })
  @IsOptional()
  @IsString()
  telegramId?: string;

  @ApiProperty({ description: 'Bot status', enum: ['active', 'pending_review'] })
  @IsEnum(['active', 'pending_review'])
  status!: string;

  @ApiPropertyOptional({ description: 'Error message if registration failed' })
  @IsOptional()
  @IsString()
  error?: string;
}

/**
 * Get available orders request
 */
export class GetOrdersRequestDto {
  @ApiProperty({ description: 'Bot token' })
  @IsString()
  key!: string;

  @ApiProperty({ description: 'Telegram user ID', example: 123456789 })
  @IsNumber()
  userId!: number;

  @ApiProperty({ description: 'Telegram chat ID', example: 123456789 })
  @IsNumber()
  chatId!: number;

  @ApiPropertyOptional({ description: 'User language code', example: 'en' })
  @IsOptional()
  @IsString()
  languageCode?: string;

  @ApiPropertyOptional({ description: 'User gender', enum: ['male', 'female'] })
  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: 'male' | 'female';

  @ApiPropertyOptional({ description: 'User age', example: 25 })
  @IsOptional()
  @IsNumber()
  age?: number;
}

/**
 * Target information
 */
export class SourceOrderTargetDto {
  @ApiProperty({ description: 'Target type', enum: ['channel', 'group', 'bot'] })
  @IsEnum(['channel', 'group', 'bot'])
  type!: string;

  @ApiProperty({ description: 'Target username', example: '@target_channel' })
  @IsString()
  username!: string;

  @ApiProperty({
    description: 'Direct link to target',
    example: 'https://t.me/target_channel',
  })
  @IsString()
  link!: string;

  @ApiPropertyOptional({ description: 'Target display name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Target photo URL' })
  @IsOptional()
  @IsString()
  photo?: string;
}

/**
 * Order requirements
 */
export class SourceOrderRequirementsDto {
  @ApiPropertyOptional({ description: 'Minimum age', example: 18 })
  @IsOptional()
  @IsNumber()
  minAge?: number;

  @ApiPropertyOptional({ description: 'Maximum age', example: 45 })
  @IsOptional()
  @IsNumber()
  maxAge?: number;

  @ApiPropertyOptional({ description: 'Required gender', enum: ['male', 'female'] })
  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: 'male' | 'female';

  @ApiPropertyOptional({
    description: 'Required countries',
    type: [String],
    example: ['US', 'UK', 'CA'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];
}

/**
 * Order DTO for bot API
 */
export class SourceOrderDto {
  @ApiProperty({ description: 'Order ID', example: 'ORD-123456' })
  @IsString()
  orderId!: string;

  @ApiProperty({
    description: 'Action type',
    enum: ['subscribe', 'join', 'view', 'react', 'comment'],
  })
  @IsEnum(['subscribe', 'join', 'view', 'react', 'comment'])
  action!: string;

  @ApiProperty({ description: 'Target information' })
  @ValidateNested()
  @Type(() => SourceOrderTargetDto)
  target!: SourceOrderTargetDto;

  @ApiProperty({
    description: 'Reward for completion (decimal string)',
    example: '0.50',
  })
  @IsString()
  reward!: string;

  @ApiPropertyOptional({ description: 'Targeting requirements' })
  @IsOptional()
  @ValidateNested()
  @Type(() => SourceOrderRequirementsDto)
  requirements?: SourceOrderRequirementsDto;

  @ApiPropertyOptional({ description: 'Order description' })
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * Get orders response
 */
export class GetOrdersResponseDto {
  @ApiProperty({ description: 'Available orders', type: [SourceOrderDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SourceOrderDto)
  orders!: SourceOrderDto[];

  @ApiPropertyOptional({ description: 'Status message' })
  @IsOptional()
  @IsString()
  message?: string;
}

/**
 * Check subscription status request
 */
export class CheckStatusRequestDto {
  @ApiProperty({ description: 'Bot token' })
  @IsString()
  key!: string;

  @ApiProperty({ description: 'Telegram user ID' })
  @IsNumber()
  userId!: number;

  @ApiProperty({ description: 'Order ID to check' })
  @IsString()
  orderId!: string;
}

/**
 * Check subscription status response
 */
export class CheckStatusResponseDto {
  @ApiProperty({
    description: 'Subscription status',
    enum: ['subscribed', 'not_subscribed', 'pending', 'verified', 'completed'],
  })
  @IsEnum(['subscribed', 'not_subscribed', 'pending', 'verified', 'completed'])
  status!: string;

  @ApiProperty({ description: 'Whether user can proceed' })
  @IsBoolean()
  canProceed!: boolean;

  @ApiPropertyOptional({ description: 'Status message' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Completion timestamp' })
  @IsOptional()
  @IsString()
  completedAt?: string;
}

/**
 * Complete action request
 */
export class CompleteActionRequestDto {
  @ApiProperty({ description: 'Bot token' })
  @IsString()
  key!: string;

  @ApiProperty({ description: 'Telegram user ID' })
  @IsNumber()
  userId!: number;

  @ApiPropertyOptional({ description: 'Telegram username' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({
    description: 'Action type',
    enum: ['subscribe', 'join', 'view', 'react', 'comment'],
  })
  @IsEnum(['subscribe', 'join', 'view', 'react', 'comment'])
  actionType!: string;

  @ApiProperty({
    description: 'Completion timestamp (ISO 8601)',
    example: '2025-11-05T10:30:00Z',
  })
  @IsString()
  completedAt!: string;

  @ApiPropertyOptional({ description: 'Proof of completion' })
  @IsOptional()
  proof?: {
    screenshotUrl?: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Complete action response
 */
export class CompleteActionResponseDto {
  @ApiProperty({ description: 'Whether action was accepted' })
  @IsBoolean()
  success!: boolean;

  @ApiPropertyOptional({ description: 'Action ID' })
  @IsOptional()
  @IsString()
  actionId?: string;

  @ApiPropertyOptional({
    description: 'Action status',
    enum: ['verified', 'pending', 'rejected'],
  })
  @IsOptional()
  @IsEnum(['verified', 'pending', 'rejected'])
  status?: string;

  @ApiPropertyOptional({ description: 'Reward amount (decimal string)' })
  @IsOptional()
  @IsString()
  reward?: string;

  @ApiPropertyOptional({ description: 'User total earnings (decimal string)' })
  @IsOptional()
  @IsString()
  userEarnings?: string;

  @ApiPropertyOptional({ description: 'Order progress information' })
  @IsOptional()
  orderProgress?: {
    currentCount: number;
    targetCount: number;
    percentage: number;
  };

  @ApiPropertyOptional({ description: 'Error message if rejected' })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional({ description: 'Rejection reason' })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Get user stats response
 */
export class GetUserStatsResponseDto {
  @ApiProperty({ description: 'Telegram user ID' })
  @IsNumber()
  userId!: number;

  @ApiPropertyOptional({ description: 'Telegram username' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ description: 'Total earnings (decimal string)', example: '15.50' })
  @IsString()
  totalEarnings!: string;

  @ApiPropertyOptional({
    description: 'Pending earnings (decimal string)',
    example: '2.00',
  })
  @IsOptional()
  @IsString()
  pendingEarnings?: string;

  @ApiProperty({ description: 'Total completed actions' })
  @IsNumber()
  totalActions!: number;

  @ApiProperty({ description: 'Completion rate percentage', example: '95.5' })
  @IsString()
  completionRate!: string;

  @ApiPropertyOptional({ description: 'User rank among all users' })
  @IsOptional()
  @IsNumber()
  rank?: number;

  @ApiPropertyOptional({ description: 'Number of available orders' })
  @IsOptional()
  @IsNumber()
  availableOrders?: number;

  @ApiPropertyOptional({ description: 'When user joined' })
  @IsOptional()
  @IsString()
  joinedAt?: string;

  @ApiPropertyOptional({ description: 'Last activity timestamp' })
  @IsOptional()
  @IsString()
  lastSeenAt?: string;
}

/**
 * Get bot stats response
 * Reuses existing TrafficSourceStatsDto structure
 */
export class GetBotStatsResponseDto {
  @ApiProperty({ description: 'Traffic source ID' })
  @IsString()
  sourceId!: string;

  @ApiPropertyOptional({ description: 'Bot username' })
  @IsOptional()
  @IsString()
  botUsername?: string;

  @ApiPropertyOptional({ description: 'Statistics period', example: 'all' })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiProperty({ description: 'Total users in bot' })
  @IsNumber()
  totalUsers!: number;

  @ApiProperty({ description: 'Active users in period' })
  @IsNumber()
  activeUsers!: number;

  @ApiProperty({ description: 'Total earnings distributed (decimal string)' })
  @IsString()
  totalEarnings!: string;

  @ApiProperty({ description: 'Total completed actions' })
  @IsNumber()
  totalActions!: number;

  @ApiProperty({ description: 'Average completion rate', example: '92.3' })
  @IsString()
  completionRate!: string;

  @ApiProperty({ description: 'Number of orders completed' })
  @IsNumber()
  ordersCompleted!: number;

  @ApiProperty({ description: 'Number of active orders' })
  @IsNumber()
  ordersActive!: number;
}
