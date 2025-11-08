import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

/**
 * Bot Token Validation DTO
 *
 * Used for validating bot tokens from bot-shared feature
 * for traffic operations integration
 */
export class BotTokenValidationDto {
  @ApiProperty({
    description: 'Bot token to validate',
    example: 'bot123456:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+:[A-Za-z0-9_-]{35}$/, {
    message: 'Invalid bot token format. Expected format: botId:authToken',
  })
  token!: string;

  @ApiProperty({
    description: 'Optional traffic operation context for validation',
    example: 'traffic_sell',
    required: false,
  })
  @IsOptional()
  @IsString()
  operationContext?: string;
}

/**
 * Bot Token Validation Response DTO
 */
export class BotTokenValidationResponseDto {
  @ApiProperty({
    description: 'Token validation status',
    example: true,
  })
  isValid!: boolean;

  @ApiProperty({
    description: 'Bot ID extracted from token',
    example: '123456',
    required: false,
  })
  botId?: string;

  @ApiProperty({
    description: 'Bot username if available',
    example: '@my_traffic_bot',
    required: false,
  })
  botUsername?: string;

  @ApiProperty({
    description: 'Bot permissions for traffic operations',
    example: ['traffic_sell', 'traffic_stats'],
    type: [String],
    required: false,
  })
  permissions?: string[];

  @ApiProperty({
    description: 'Token expiration timestamp',
    example: '2024-12-31T23:59:59Z',
    required: false,
  })
  expiresAt?: Date;

  @ApiProperty({
    description: 'Validation error message if token is invalid',
    example: 'Token has expired',
    required: false,
  })
  error?: string;

  @ApiProperty({
    description: 'Additional validation metadata',
    example: { rateLimit: { remaining: 99, resetAt: '2024-09-17T15:00:00Z' } },
    required: false,
  })
  metadata?: Record<string, unknown>;
}

/**
 * Traffic Operation with Token DTO
 *
 * Extends traffic operations with optional bot token validation
 */
export class TrafficOperationWithTokenDto {
  @ApiProperty({
    description: 'Optional bot token for validation',
    example: 'bot123456:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+:[A-Za-z0-9_-]{35}$/, {
    message: 'Invalid bot token format. Expected format: botId:authToken',
  })
  botToken?: string;

  @ApiProperty({
    description: 'Skip token validation (for non-bot operations)',
    example: false,
    required: false,
  })
  @IsOptional()
  skipTokenValidation?: boolean;
}
