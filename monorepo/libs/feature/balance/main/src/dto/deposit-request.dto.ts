import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsEnum, IsOptional, Min } from 'class-validator';

export enum PaymentMethod {
  CreditCard = 'credit_card',
  Crypto = 'crypto',
  BankTransfer = 'bank_transfer',
  PayPal = 'paypal',
  Stripe = 'stripe',
}

/**
 * Deposit request DTO for creating deposit transactions
 */
export class DepositRequestDto {
  @ApiProperty({
    description: 'Amount to deposit in minor currency units (e.g., cents)',
    example: 10000,
    minimum: 100,
  })
  @IsNumber()
  @Min(100)
  amount!: number;

  @ApiProperty({
    description: 'Payment method to use for deposit',
    enum: PaymentMethod,
    example: PaymentMethod.CreditCard,
  })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Currency code (ISO 4217)',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string = 'USD';
}
