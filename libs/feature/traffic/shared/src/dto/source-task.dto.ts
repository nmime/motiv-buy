import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

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
