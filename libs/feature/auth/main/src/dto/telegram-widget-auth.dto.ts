/* eslint-disable @typescript-eslint/naming-convention */
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';

/**
 * Telegram Widget Authentication DTO
 * Note: Property names use snake_case to match Telegram API format
 */
export class TelegramWidgetAuthDto {
  @ApiProperty({
    description: 'Telegram user ID',
    example: '123456789',
  })
  @IsNumberString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({
    description: 'First name',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  first_name!: string;

  @ApiProperty({
    description: 'Last name',
    required: false,
    example: 'Doe',
  })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiProperty({
    description: 'Username',
    required: false,
    example: 'johndoe',
  })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({
    description: 'Photo URL',
    required: false,
    example: 'https://t.me/i/userpic/320/xyz.jpg',
  })
  @IsString()
  @IsOptional()
  photo_url?: string;

  @ApiProperty({
    description: 'Authentication date timestamp',
    example: '1640995200',
  })
  @IsNumberString()
  @IsNotEmpty()
  auth_date!: string;

  @ApiProperty({
    description: 'Hash for verification',
    example: 'abc123def456',
  })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @ApiProperty({
    description: 'UTM source parameter',
    required: false,
  })
  @IsString()
  @IsOptional()
  utmSource?: string;

  @ApiProperty({
    description: 'UTM medium parameter',
    required: false,
  })
  @IsString()
  @IsOptional()
  utmMedium?: string;

  @ApiProperty({
    description: 'UTM campaign parameter',
    required: false,
  })
  @IsString()
  @IsOptional()
  utmCampaign?: string;

  @ApiProperty({
    description: 'UTM content parameter',
    required: false,
  })
  @IsString()
  @IsOptional()
  utmContent?: string;

  @ApiProperty({
    description: 'Referral code',
    required: false,
  })
  @IsString()
  @IsOptional()
  refCode?: string;
}
