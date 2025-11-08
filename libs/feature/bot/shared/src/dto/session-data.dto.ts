import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsObject, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Session Data DTO
 *
 * Data Transfer Object for session data operations.
 * Handles session creation, updates, and validation.
 *
 * @class SessionDataDto
 */
export class SessionDataDto {
  @ApiProperty({
    description: 'User identifier',
    example: '123456789',
  })
  @IsString()
  userId!: string;

  @ApiProperty({
    description: 'Session data payload',
    type: Object,
    example: {
      conversationState: { currentStep: 'profile_setup' },
      preferences: { language: 'en' },
    },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiProperty({
    description: 'Session expiration date',
    required: false,
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  @ApiProperty({
    description: 'Session metadata',
    required: false,
    type: Object,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  constructor(object: SessionDataDto) {
    Object.assign(this, object);
  }
}

/**
 * Update Session DTO
 *
 * DTO for session update operations.
 */
export class UpdateSessionDto {
  @ApiProperty({
    description: 'Session data to update',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiProperty({
    description: 'Whether to extend session expiration',
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  extendExpiration?: boolean;

  @ApiProperty({
    description: 'Merge strategy for data updates',
    required: false,
    enum: ['merge', 'replace'],
    example: 'merge',
  })
  @IsOptional()
  @IsString()
  mergeStrategy?: 'merge' | 'replace';

  constructor(object: UpdateSessionDto) {
    Object.assign(this, object);
  }
}

/**
 * Session Response DTO
 *
 * Response object for session operations.
 */
export class SessionResponseDto {
  @ApiProperty({
    description: 'User identifier',
    example: '123456789',
  })
  userId!: string;

  @ApiProperty({
    description: 'Session data',
    type: Object,
  })
  data!: Record<string, unknown>;

  @ApiProperty({
    description: 'Session creation timestamp',
    example: '2024-01-01T00:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Session last update timestamp',
    example: '2024-01-01T12:00:00Z',
  })
  updatedAt!: Date;

  @ApiProperty({
    description: 'Session expiration timestamp',
    example: '2024-12-31T23:59:59Z',
  })
  expiresAt!: Date;

  @ApiProperty({
    description: 'Whether session is valid',
    example: true,
  })
  isValid!: boolean;

  constructor(object: SessionResponseDto) {
    Object.assign(this, object);
  }
}

/**
 * Conversation State DTO
 *
 * DTO for conversation state management.
 */
export class ConversationStateDto {
  @ApiProperty({
    description: 'Current conversation step',
    example: 'waiting_for_phone',
  })
  @IsString()
  currentStep!: string;

  @ApiProperty({
    description: 'Available next steps',
    type: [String],
    example: ['verify_phone', 'change_phone'],
  })
  @IsOptional()
  availableSteps?: string[];

  @ApiProperty({
    description: 'Conversation context',
    type: Object,
    example: { phoneNumber: '+1234567890', attempts: 1 },
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @ApiProperty({
    description: 'Whether conversation is active',
    example: true,
  })
  @IsBoolean()
  isActive!: boolean;

  constructor(object: ConversationStateDto) {
    Object.assign(this, object);
  }
}
