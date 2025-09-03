import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class NotificationSettingsDto {
  @ApiProperty({
    description: 'Enable limit notifications',
    example: true,
  })
  limitNotifications!: boolean;

  @ApiProperty({
    description: 'Enable inactivity notifications',
    example: true,
  })
  inactivityNotifications!: boolean;
}

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({
    description: 'Enable/disable limit notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  limitNotifications?: boolean;

  @ApiPropertyOptional({
    description: 'Enable/disable inactivity notifications',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  inactivityNotifications?: boolean;
}