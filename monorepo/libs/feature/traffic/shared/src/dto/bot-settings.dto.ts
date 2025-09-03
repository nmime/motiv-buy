import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsArray, IsOptional, Min, Max } from 'class-validator';

export class BotSettingsDto {
  @ApiProperty({
    description: 'Bot ID',
    example: 'uuid-bot-id',
  })
  botId!: string;

  @ApiProperty({
    description: 'Enable private messages',
    example: true,
  })
  enablePrivateMessages!: boolean;

  @ApiProperty({
    description: 'Enable group messages',
    example: true,
  })
  enableGroupMessages!: boolean;

  @ApiProperty({
    description: 'Enable channel messages',
    example: false,
  })
  enableChannelMessages!: boolean;

  @ApiProperty({
    description: 'Maximum partners per day',
    example: 10,
  })
  maxPartnersPerDay!: number;

  @ApiProperty({
    description: 'Timer between actions in seconds',
    example: 60,
  })
  timerBetweenActions!: number;

  @ApiProperty({
    description: 'Excluded themes',
    example: ['adult', 'gambling'],
    type: [String],
  })
  excludedThemes!: string[];

  @ApiProperty({
    description: 'Bot active status',
    example: true,
  })
  isActive!: boolean;
}

export class UpdateBotSettingsDto {
  @ApiProperty({
    description: 'Enable private messages',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  enablePrivateMessages?: boolean;

  @ApiProperty({
    description: 'Enable group messages',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  enableGroupMessages?: boolean;

  @ApiProperty({
    description: 'Enable channel messages',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  enableChannelMessages?: boolean;

  @ApiProperty({
    description: 'Maximum partners per day',
    example: 15,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxPartnersPerDay?: number;

  @ApiProperty({
    description: 'Timer between actions in seconds',
    example: 90,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(3600)
  timerBetweenActions?: number;

  @ApiProperty({
    description: 'Excluded themes',
    example: ['adult', 'gambling', 'crypto'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  excludedThemes?: string[];

  @ApiProperty({
    description: 'Bot active status',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}