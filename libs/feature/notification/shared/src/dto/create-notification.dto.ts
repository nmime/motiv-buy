import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { NotificationChannel, NotificationExtra, NotificationPriority, NotificationTargetType } from '@app/database';

export class CreateNotificationDto<T = Record<string, string | number>> {
  @IsEnum(NotificationChannel)
  @IsNotEmpty()
  channel!: NotificationChannel;

  @IsEnum(NotificationTargetType)
  @IsNotEmpty()
  targetType!: NotificationTargetType;

  @IsString()
  @IsNotEmpty()
  targetId!: string;

  @IsString()
  @IsNotEmpty()
  templateCode!: string;

  @IsObject()
  @IsOptional()
  data?: T;

  @IsObject()
  @IsOptional()
  extra?: NotificationExtra;

  @IsNumber()
  @IsOptional()
  priority?: NotificationPriority;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxRetries?: number;

  @IsDateString()
  @IsOptional()
  sendAt?: string;

  @Matches(/^([0-1]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
  @IsOptional()
  sendTimeFrom?: string;

  @Matches(/^([0-1]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
  @IsOptional()
  sendTimeTo?: string;

  @IsString()
  @IsOptional()
  locale?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
