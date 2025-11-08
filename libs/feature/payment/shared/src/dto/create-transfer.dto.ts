import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  MaxLength,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { CurrencyCode, PaymentProvider } from '@app/database';

/**
 * Custom validator to ensure withdrawal amount is within acceptable range
 * Minimum: 1.00 (prevent dust withdrawals that cost more in fees)
 * Maximum: 100,000.00 (prevent extremely large withdrawals without verification)
 */
@ValidatorConstraint({ name: 'withdrawalAmountRange', async: false })
export class WithdrawalAmountRangeValidator implements ValidatorConstraintInterface {
  validate(amount: string): boolean {
    const num = parseFloat(amount);

    if (isNaN(num)) {
      return false;
    }

    return num >= 1.0 && num <= 100000.0;
  }

  defaultMessage(): string {
    return 'Withdrawal amount must be between 1.00 and 100,000.00';
  }
}

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
    description: 'Amount to withdraw in cryptocurrency units (1.00 - 100,000.00)',
    example: '50.25',
    pattern: '^\\d+(\\.\\d+)?$',
    minimum: 1.0,
    maximum: 100000.0,
  })
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'Amount must be a positive number string',
  })
  @Validate(WithdrawalAmountRangeValidator)
  amount!: string;

  @ApiProperty({
    description: 'Currency code to use for the withdrawal',
    enum: CurrencyCode,
    example: CurrencyCode.Usdt,
  })
  @IsEnum(CurrencyCode, {
    message: 'Currency must be a valid currency code',
  })
  currency!: CurrencyCode;

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

  @ApiPropertyOptional({
    description: 'Optional payment provider selection. If not specified, best provider will be selected automatically.',
    enum: PaymentProvider,
    example: PaymentProvider.CryptoBot,
  })
  @IsOptional()
  @IsEnum(PaymentProvider, {
    message: 'Provider must be a valid payment provider',
  })
  provider?: PaymentProvider;

  @ApiPropertyOptional({
    description:
      'Optional destination for withdrawal (e.g., bank card number for YooKassa, wallet address for crypto providers)',
    example: '1234567890123456',
    maxLength: 256,
  })
  @IsOptional()
  @IsString()
  @MaxLength(256, {
    message: 'Destination cannot exceed 256 characters',
  })
  destination?: string;
}
