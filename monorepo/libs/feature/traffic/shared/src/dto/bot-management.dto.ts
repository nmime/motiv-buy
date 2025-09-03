import { ApiProperty } from '@nestjs/swagger';

export enum BotStatus {
  ACTIVE = 'active',
  PENDING_MODERATION = 'pending_moderation',
  SUSPENDED = 'suspended',
  REJECTED = 'rejected',
}

export enum BotAction {
  START = 'start',
  PAUSE = 'pause',
  DELETE = 'delete',
}

export class BotActionDto {
  @ApiProperty({
    description: 'Action to perform on bot',
    enum: BotAction,
    example: BotAction.START,
  })
  action!: BotAction;
}

export class BotResponseDto {
  @ApiProperty({
    description: 'Bot ID',
    example: 'uuid-bot-id',
  })
  id!: string;

  @ApiProperty({
    description: 'Bot name',
    example: '@my_traffic_bot',
  })
  name!: string;

  @ApiProperty({
    description: 'Traffic sold count',
    example: 15000,
  })
  trafficSold!: number;

  @ApiProperty({
    description: 'Money earned',
    example: 2500.50,
  })
  moneyEarned!: number;

  @ApiProperty({
    description: 'Bot status',
    enum: BotStatus,
    example: BotStatus.ACTIVE,
  })
  status!: BotStatus;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-08-31T14:26:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Last update date',
    example: '2024-08-31T14:26:00Z',
  })
  updatedAt!: Date;
}