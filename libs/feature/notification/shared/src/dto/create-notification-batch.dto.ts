import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTemplateNotificationDto } from './create-template-notification.dto';

export class CreateNotificationBatchDto<T = Record<string, unknown>> {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTemplateNotificationDto)
  notifications!: CreateTemplateNotificationDto<T>[];
}
