import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { CreateNotificationDto } from './create-notification.dto';

export class CreateTemplateNotificationDto<T = Record<string, string | number>> extends CreateNotificationDto<T> {
  @IsString()
  @IsNotEmpty()
  templateCode!: string;

  @IsObject()
  @IsOptional()
  variables?: Record<string, string | number>;
}
