import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * PRIVATE API DTOs for Traffic Source Management
 * For admins/users to create and manage traffic sources
 */

/**
 * Create traffic source request
 *
 * Supports two flows:
 * 1. WITH Token: Provide botToken for automated validation via Telegram API
 * 2. WITHOUT Token: Provide botUsername only for manual moderation
 *
 * At least one of botToken or botUsername must be provided
 */
export class CreateSourceDto {
  @ApiProperty({ description: 'Source name', example: 'My Traffic Bot' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Source description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Telegram bot token (optional). If provided, bot will be validated via Telegram API. Format: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
    example: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  botToken?: string;

  @ApiPropertyOptional({
    description:
      'Bot username (required if botToken not provided). Used for manual moderation flow. Example: @mytrafficbot',
    example: '@mytrafficbot',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  botUsername?: string;

  @ApiPropertyOptional({ description: 'Categories/tags', type: [String], example: ['crypto', 'trading'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];
}

/**
 * Update traffic source request
 */
export class UpdateSourceDto {
  @ApiPropertyOptional({ description: 'Source name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Source description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Bot username' })
  @IsOptional()
  @IsString()
  botUsername?: string;

  @ApiPropertyOptional({ description: 'Categories/tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];
}

/**
 * Traffic source response
 */
export class SourceResponseDto {
  @ApiProperty({ description: 'Source ID', example: '01234567-89ab-cdef-0123-456789abcdef' })
  id!: string;

  @ApiProperty({ description: 'Source name', example: 'My Traffic Bot' })
  name!: string;

  @ApiPropertyOptional({ description: 'Source description' })
  description?: string;

  @ApiProperty({ description: 'Source type', example: 'bot_with_token' })
  type!: string;

  @ApiPropertyOptional({ description: 'Bot username', example: '@mytrafficbot' })
  botUsername?: string;

  @ApiPropertyOptional({ description: 'Telegram bot ID', example: '123456' })
  telegramId?: string;

  @ApiProperty({ description: 'Active status', example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'API key for public API', example: 'sk_live_abc123...' })
  apiKey!: string;

  @ApiProperty({ description: 'Created at timestamp', example: '2025-01-06T12:00:00Z' })
  createdAt!: string;

  @ApiProperty({ description: 'Updated at timestamp', example: '2025-01-06T12:00:00Z' })
  updatedAt!: string;
}

/**
 * Traffic source details (includes additional info)
 */
export class SourceDetailsDto extends SourceResponseDto {
  @ApiPropertyOptional({ description: 'Total tasks completed', example: 1500 })
  totalTasksCompleted?: number;

  @ApiPropertyOptional({ description: 'Active users count', example: 250 })
  activeUsersCount?: number;

  @ApiPropertyOptional({ description: 'Total earnings (decimal string)', example: '1250.50' })
  totalEarnings?: string;

  @ApiPropertyOptional({ description: 'Categories/tags', type: [String], example: ['crypto', 'trading'] })
  categories?: string[];
}

/**
 * Regenerate API key response
 */
export class RegenerateApiKeyResponseDto {
  @ApiProperty({ description: 'New API key', example: 'sk_live_new_key_xyz789...' })
  apiKey!: string;

  @ApiProperty({ description: 'Success message', example: 'API key regenerated successfully' })
  message!: string;
}
