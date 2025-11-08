import { ApiProperty } from '@nestjs/swagger';

export enum BotStatus {
  Active = 'active',
  PendingModeration = 'pending_moderation',
  Suspended = 'suspended',
  Rejected = 'rejected',
}

export enum BotAction {
  Start = 'start',
  Pause = 'pause',
  Delete = 'delete',
}

export class BotActionDto {
  @ApiProperty({
    description: 'Action to perform on bot',
    enum: BotAction,
    example: BotAction.Start,
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
    description: 'Bot ID (alias)',
    example: 'uuid-bot-id',
  })
  botId!: string;

  @ApiProperty({
    description: 'Bot name',
    example: '@my_traffic_bot',
  })
  name!: string;

  @ApiProperty({
    description: 'Bot username',
    example: '@my_traffic_bot',
  })
  botUsername!: string;

  @ApiProperty({
    description: 'Traffic sold count',
    example: 15000,
  })
  trafficSold!: number;

  @ApiProperty({
    description: 'Money earned',
    example: 2500.5,
  })
  moneyEarned!: number;

  @ApiProperty({
    description: 'Total earnings',
    example: '2500.50',
  })
  totalEarnings!: string;

  @ApiProperty({
    description: 'Today earnings',
    example: '125.00',
  })
  todayEarnings!: string;

  @ApiProperty({
    description: 'Active orders count',
    example: 5,
  })
  activeOrders!: number;

  @ApiProperty({
    description: 'Bot status',
    enum: BotStatus,
    example: BotStatus.Active,
  })
  status!: BotStatus;

  @ApiProperty({
    description: 'Traffic types supported',
    type: [String],
    example: ['private_messages', 'group_messages'],
  })
  trafficTypes!: string[];

  @ApiProperty({
    description: 'Last activity timestamp',
    example: '2024-08-31T14:26:00Z',
  })
  lastActivity!: Date;

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
