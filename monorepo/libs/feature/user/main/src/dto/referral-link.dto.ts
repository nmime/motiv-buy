import { ApiProperty } from '@nestjs/swagger';

export class ReferralLinkDto {
  @ApiProperty({ description: 'Telegram message with referral link' })
  telegramMessage: string;

  @ApiProperty({ description: 'Referral link URL' })
  link: string;
}
