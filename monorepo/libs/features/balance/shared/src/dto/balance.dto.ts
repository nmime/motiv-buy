import { ApiProperty } from '@nestjs/swagger';

export class BalanceDto {
  @ApiProperty({
    description: 'Current balance amount',
    example: 15750.50,
  })
  amount!: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'RUB',
  })
  currency!: string;
}