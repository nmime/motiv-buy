import { ApiProperty } from '@nestjs/swagger';

export class BalanceDto {
  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({
    description: 'Current balance amount',
    example: 15750.5,
  })
  amount!: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'RUB',
  })
  currency!: string;

  @ApiProperty({
    description: 'Available amount for withdrawal',
    example: 15000.0,
  })
  availableAmount!: number;

  @ApiProperty({
    description: 'Pending amount awaiting clearance',
    example: 750.5,
  })
  pendingAmount!: number;

  @ApiProperty({
    description: 'Total amount earned historically',
    example: 50000.0,
  })
  totalEarned!: number;

  @ApiProperty({
    description: 'Last transaction timestamp',
    example: '2025-10-02T18:56:00.000Z',
    required: false,
  })
  lastTransactionAt?: Date;
}
