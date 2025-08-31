import { ApiProperty } from '@nestjs/swagger';

export class ReferralStatsDto {
  @ApiProperty({
    description: 'Number of referrals',
    example: 10,
  })
  referralsCount!: number;

  @ApiProperty({
    description: 'Total earnings from referrals',
    example: 1500.50,
  })
  totalEarnings!: number;
}