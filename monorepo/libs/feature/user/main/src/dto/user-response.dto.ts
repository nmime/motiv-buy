import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserReferralDto {
  @ApiProperty({ description: 'Total number of referrals' })
  count!: number;

  @ApiProperty({ description: 'Total earnings from referrals' })
  earned!: number;

  @ApiProperty({ description: 'Referral link for sharing' })
  link!: string;

  @ApiProperty({ description: 'Telegram message ID for sharing (optional)' })
  messageId?: string;
}

export class UserResponseDto {
  @ApiProperty({ description: 'User ID' })
  id!: string;

  @ApiProperty({ description: 'User first name' })
  name!: string;

  @ApiPropertyOptional({ description: 'Username' })
  username?: string;

  @ApiPropertyOptional({ description: 'User language code' })
  language?: string;

  @ApiProperty({ description: 'Referral information', type: UserReferralDto })
  referral!: UserReferralDto;
}
