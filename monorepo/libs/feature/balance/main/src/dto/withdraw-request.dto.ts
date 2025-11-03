import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, MaxLength, Min, IsNumber } from 'class-validator';
import { Cryptocurrency } from '@app/feature-payment-shared';

/**
 * Withdrawal request DTO
 * Creates a cryptocurrency withdrawal to external wallet
 */
export class WithdrawRequestDto {
  @ApiProperty({
    description: 'Amount to withdraw in RUB',
    example: 1000,
    minimum: 100,
  })
  @IsNumber()
  @Min(100, {
    message: 'Minimum withdrawal amount is 100 RUB',
  })
  amount!: number;

  @ApiProperty({
    description: 'Cryptocurrency to receive withdrawal in',
    enum: Cryptocurrency,
    example: Cryptocurrency.Usdt,
  })
  @IsEnum(Cryptocurrency, {
    message: 'Currency must be a valid cryptocurrency',
  })
  currency!: Cryptocurrency;

  @ApiProperty({
    description: 'Telegram user ID for withdrawal destination (CryptoBot)',
    example: 123456789,
  })
  @IsNumber()
  telegramUserId!: number;

  @ApiPropertyOptional({
    description: 'Optional comment for the withdrawal',
    example: 'Withdrawal to my wallet',
    maxLength: 1024,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  comment?: string;
}
