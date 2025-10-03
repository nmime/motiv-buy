import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsUUID, IsNumber, Min, Max } from 'class-validator';

export enum TrafficTargetType {
  Channel = 'channel',
  Group = 'group',
  Chat = 'chat',
}

export enum TrafficTargetStatus {
  Active = 'active',
  Inactive = 'inactive',
  PendingVerification = 'pending_verification',
  Suspended = 'suspended',
}

/**
 * Create traffic target DTO for new traffic receivers
 */
export class CreateTrafficTargetDto {
  @ApiProperty({
    description: 'Target type (channel, group, or chat)',
    enum: TrafficTargetType,
    example: TrafficTargetType.Channel,
  })
  @IsEnum(TrafficTargetType)
  type!: TrafficTargetType;

  @ApiProperty({
    description: 'Target URL or username',
    example: 'https://t.me/my_channel',
  })
  @IsString()
  targetUrl!: string;

  @ApiProperty({
    description: 'Target display name',
    example: 'My Awesome Channel',
  })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: 'Target description',
    example: 'Tech news and reviews',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * Traffic target DTO representing a channel/group receiving traffic
 */
export class TrafficTargetDto {
  @ApiProperty({
    description: 'Target ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  id!: string;

  @ApiProperty({
    description: 'User ID who manages this target',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  managedBy!: string;

  @ApiProperty({
    description: 'Target type',
    enum: TrafficTargetType,
    example: TrafficTargetType.Channel,
  })
  @IsEnum(TrafficTargetType)
  type!: TrafficTargetType;

  @ApiProperty({
    description: 'Target URL',
    example: 'https://t.me/my_channel',
  })
  @IsString()
  targetUrl!: string;

  @ApiProperty({
    description: 'Target name',
    example: 'My Awesome Channel',
  })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: 'Target description',
    example: 'Tech news and reviews',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Target status',
    enum: TrafficTargetStatus,
    example: TrafficTargetStatus.Active,
  })
  @IsEnum(TrafficTargetStatus)
  status!: TrafficTargetStatus;

  @ApiProperty({
    description: 'Target creation timestamp',
    example: '2024-01-01T12:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Target last update timestamp',
    example: '2024-01-02T14:30:00Z',
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'Last verification timestamp',
    example: '2024-01-02T10:00:00Z',
  })
  @IsOptional()
  lastVerifiedAt?: Date;
}

/**
 * Update traffic target DTO for modifying existing targets
 */
export class UpdateTrafficTargetDto {
  @ApiPropertyOptional({
    description: 'Updated target name',
    example: 'My Updated Channel',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated description',
    example: 'Updated tech news channel',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated status',
    enum: TrafficTargetStatus,
    example: TrafficTargetStatus.Active,
  })
  @IsOptional()
  @IsEnum(TrafficTargetStatus)
  status?: TrafficTargetStatus;
}

/**
 * Traffic target validation result DTO
 */
export class TrafficTargetValidationDto {
  @ApiProperty({
    description: 'Whether the target is valid and accessible',
    example: true,
  })
  isValid!: boolean;

  @ApiProperty({
    description: 'Validation status message',
    example: 'Target is accessible and properly configured',
  })
  message!: string;

  @ApiPropertyOptional({
    description: 'Detected member count (if available)',
    example: 15420,
  })
  @IsOptional()
  @IsNumber()
  memberCount?: number;

  @ApiPropertyOptional({
    description: 'Validation errors or warnings',
    type: [String],
    example: ['Bot is not admin in the group'],
  })
  @IsOptional()
  errors?: string[];
}

/**
 * Traffic target statistics DTO
 */
export class TrafficTargetStatsDto {
  @ApiProperty({
    description: 'Target ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  targetId!: string;

  @ApiProperty({
    description: 'Total traffic received',
    example: 5000,
  })
  @IsNumber()
  @Min(0)
  totalTrafficReceived!: number;

  @ApiProperty({
    description: 'Active orders count',
    example: 3,
  })
  @IsNumber()
  @Min(0)
  activeOrders!: number;

  @ApiProperty({
    description: 'Completed orders count',
    example: 12,
  })
  @IsNumber()
  @Min(0)
  completedOrders!: number;

  @ApiProperty({
    description: 'Total amount spent on this target',
    example: 250.5,
  })
  @IsNumber()
  @Min(0)
  totalSpent!: number;

  @ApiProperty({
    description: 'Average traffic quality score (0-100)',
    example: 85,
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
