import { NotificationStatus } from '@app/database';

export class NotificationResponseDto {
  id!: string;
  status!: NotificationStatus;
  createdAt!: Date;
}

export class NotificationBatchResponseDto {
  created!: number;
  notifications!: NotificationResponseDto[];
}
