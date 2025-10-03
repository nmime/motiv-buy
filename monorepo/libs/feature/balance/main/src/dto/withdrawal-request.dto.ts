import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsEnum, IsOptional, Min } from 'class-validator';

export enum WithdrawalMethod {
  BankTransfer = 'bank_transfer',
  Crypto = 'crypto',
  PayPal = 'paypal',
}

/**
 * Withdrawal request DTO for creating withdrawal transactions
 */
export class WithdrawalRequestDto {
  @ApiProperty({
    description: 'Amount to withdraw in minor currency units (e.g., cents)',
    example: 5000,
    minimum: 100,
  })
  @IsNumber()
  @Min(100)
  amount!: number;

  @ApiProperty({
    description: 'Withdrawal method',
    enum: WithdrawalMethod,
    example: WithdrawalMethod.BankTransfer,
  })
  @IsEnum(WithdrawalMethod)
  withdrawalMethod!: WithdrawalMethod;

  @ApiProperty({
    description: 'Destination address/account for withdrawal',
    example: 'bank_account_123456 or crypto_wallet_address',
  })
  @IsString()
  destination!: string;

  @ApiPropertyOptional({
    description: 'Currency code (ISO 4217)',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string = 'USD';
}
