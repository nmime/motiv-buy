import { ApiProperty } from '@nestjs/swagger';

export class BalanceDto {
  @ApiProperty({ description: 'Balance amount' })
  amount: number;

  @ApiProperty({ description: 'Currency code' })
  currency: string;
}