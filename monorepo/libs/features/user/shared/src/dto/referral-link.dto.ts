import { ApiProperty } from '@nestjs/swagger';

export class ReferralLinkDto {
  @ApiProperty({
    description: 'Referral link for Telegram bot',
    example: 'https://t.me/MotivBuyBot?start=ref_uuid',
  })
  referralLink!: string;

  @ApiProperty({
    description: 'Unique referral code',
    example: 'ref_uuid',
  })
  referralCode!: string;
}