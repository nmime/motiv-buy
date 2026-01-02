import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { CurrencyCode, PaymentProvider } from '@app/database';

/**
 * Custom validator to ensure amount is within acceptable range
 * Minimum: 0.01 (prevent zero/negative amounts)
 * Maximum: 1,000,000.00 (prevent extremely large amounts that could be errors)
 */
@ValidatorConstraint({ name: 'amountRange', async: false })
export class AmountRangeValidator implements ValidatorConstraintInterface {
  validate(amount: string): boolean {
    const num = parseFloat(amount);

    if (isNaN(num)) {
      return false;
    }

    return num >= 0.01 && num <= 1000000.0;
  }

  defaultMessage(): string {
    return 'Amount must be between 0.01 and 1,000,000.00';
  }
}

/**
 * DTO for creating payment invoices
 * Used to generate payment links for users to deposit funds
 */
export class CreateInvoiceDto {
  @ApiProperty({
    description: 'Amount to charge in cryptocurrency units (0.01 - 1,000,000.00)',
    example: '100.50',
    pattern: '^\\d+(\\.\\d+)?$',
    minimum: 0.01,
    maximum: 1000000.0,
  })
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'Amount must be a positive number string',
  })
  @Validate(AmountRangeValidator)
  amount!: string;

  @ApiProperty({
    description: 'Currency code to use for the invoice',
    enum: CurrencyCode,
    example: CurrencyCode.Usdt,
  })
  @IsEnum(CurrencyCode, {
    message: 'Currency must be a valid currency code',
  })
  currency!: CurrencyCode;

  @ApiPropertyOptional({
    description: 'Optional description for the invoice',
    example: 'Payment for traffic order #12345',
    maxLength: 1024,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024, {
    message: 'Description cannot exceed 1024 characters',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Invoice expiration time in seconds (1 second to 31 days)',
    example: 3600,
    minimum: 1,
    maximum: 2678400,
    default: 86400,
  })
  @IsOptional()
  @IsInt()
  @Min(1, {
    message: 'expiresIn must be at least 1 second',
  })
  @Max(2678400, {
    message: 'expiresIn cannot exceed 2678400 seconds (31 days)',
  })
  expiresIn?: number = 86400; // Default 24 hours

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
}
