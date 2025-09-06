import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsPositive, IsDateString } from 'class-validator';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRAFFIC_SALE_INCOME = 'traffic_sale_income',
  TRAFFIC_PURCHASE_EXPENSE = 'traffic_purchase_expense',
  REFERRAL_INCOME = 'referral_income',
}

export enum PaymentMethod {
  CRYPTO_BOT = 'crypto_bot',
  BANK_SPB = 'bank_spb',
  USDT = 'usdt',
}

export class TransactionDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: 'uuid-transaction-id',
  })
  id!: string;

  @ApiProperty({
    description: 'Transaction amount',
    example: 1500.5,
  })
  amount!: number;

  @ApiProperty({
    description: 'Transaction type',
    enum: TransactionType,
    example: TransactionType.DEPOSIT,
  })
  type!: TransactionType;

  @ApiProperty({
    description: 'Transaction date',
    example: '2024-08-31T14:26:00Z',
  })
  date!: Date;

  @ApiPropertyOptional({
    description: 'Payment method (for deposits/withdrawals)',
    enum: PaymentMethod,
    example: PaymentMethod.CRYPTO_BOT,
  })
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Related order ID (for traffic operations)',
    example: 'uuid-order-id',
  })
  orderId?: string;

  @ApiPropertyOptional({
    description: 'Transaction description',
    example: 'Deposit via Crypto Bot',
  })
  description?: string;
}

export class TransactionFilterDto {
  @ApiPropertyOptional({
    description: 'Filter by transaction type',
    enum: TransactionType,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({
    description: 'Start date for filtering (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class DepositRequestDto {
  @ApiProperty({
    description: 'Deposit amount',
    example: 1000,
  })
  @IsPositive()
  amount!: number;

  @ApiProperty({
    description: 'Payment method',
    enum: PaymentMethod,
    example: PaymentMethod.CRYPTO_BOT,
  })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}

export class WithdrawalRequestDto {
  @ApiProperty({
    description: 'Withdrawal amount',
    example: 500,
  })
  @IsPositive()
  amount!: number;

  @ApiProperty({
    description: 'Payment method',
    enum: PaymentMethod,
    example: PaymentMethod.USDT,
  })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Withdrawal address/details',
    example: 'TRX_ADDRESS_OR_CARD_NUMBER',
  })
  destination?: string;
}
