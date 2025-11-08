import { ApiProperty } from '@nestjs/swagger';

export class ReferralStatsDto {
  @ApiProperty({ description: 'Total number of referrals' })
  totalReferrals!: number;

  @ApiProperty({ description: 'Total earnings from referrals (10% commission)' })
  totalEarnings!: number;
}
