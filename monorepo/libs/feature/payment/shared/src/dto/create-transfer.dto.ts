import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, MaxLength, Matches } from 'class-validator';
import { Cryptocurrency } from '../enum/cryptocurrency.enum';

/**
 * DTO for creating withdrawal transfers
 * Used to withdraw funds from user balance to their crypto wallet
 */
export class CreateTransferDto {
  @ApiProperty({
    description: 'Telegram user ID who initiated the withdrawal',
    example: '123456789',
    pattern: '^\\d+$',
  })
  @IsString()
  @Matches(/^\d+$/, {
    message: 'userId must be a valid Telegram user ID (numeric string)',
  })
  userId!: string;

  @ApiProperty({
    description: 'Amount to withdraw in cryptocurrency units (positive decimal string)',
    example: '50.25',
    pattern: '^\\d+(\\.\\d+)?$',
  })
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'Amount must be a positive number string',
  })
  amount!: string;

  @ApiProperty({
    description: 'Cryptocurrency to use for the withdrawal',
    enum: Cryptocurrency,
    example: Cryptocurrency.USDT,
  })
  @IsEnum(Cryptocurrency, {
    message: 'Currency must be a valid cryptocurrency',
  })
  currency!: Cryptocurrency;

  @ApiPropertyOptional({
    description: 'Optional comment for the withdrawal',
    example: 'Withdrawal to personal wallet',
    maxLength: 1024,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024, {
    message: 'Comment cannot exceed 1024 characters',
  })
  comment?: string;
}
