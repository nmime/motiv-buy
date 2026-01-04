import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class NotificationSettingsDto {
  @ApiProperty({ description: 'Enable notifications when order limits are reached' })
  limitNotificationsEnabled!: boolean;

  @ApiProperty({ description: 'Enable notifications for account inactivity' })
  inactivityNotificationsEnabled!: boolean;
}

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({ description: 'Enable/disable limit notifications' })
  @IsOptional()
  @IsBoolean()
  limitNotificationsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable/disable inactivity notifications' })
  @IsOptional()
  @IsBoolean()
  inactivityNotificationsEnabled?: boolean;
}
