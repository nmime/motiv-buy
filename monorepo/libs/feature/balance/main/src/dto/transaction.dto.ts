export enum TransactionType {
  Deposit = 'deposit',
  Withdrawal = 'withdrawal',
  TrafficSaleIncome = 'traffic_sale_income',
  TrafficBuyExpense = 'traffic_buy_expense',
}

export enum PaymentMethod {
  CryptoBot = 'crypto_bot',
  BankCard = 'bank_card',
  Paypal = 'paypal',
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class TransactionDto {
  @ApiProperty({ description: 'Transaction ID' })
  id!: string;

  @ApiProperty({ description: 'Transaction amount' })
  amount!: number;

  @ApiProperty({ enum: TransactionType, description: 'Transaction type' })
  type!: TransactionType;

  @ApiProperty({ description: 'Transaction date' })
  date!: Date;

  @ApiPropertyOptional({ enum: PaymentMethod, description: 'Payment method' })
  paymentMethod?: PaymentMethod;

  @ApiProperty({ description: 'Transaction description' })
  description!: string;

  @ApiPropertyOptional({ description: 'Related order ID' })
  orderId?: string;
}

export class TransactionFilterDto {
  @ApiPropertyOptional({ enum: TransactionType, description: 'Filter by transaction type' })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ description: 'Start date for filtering' })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date for filtering' })
  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Limit number of results', default: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Offset for pagination', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

export class DepositRequestDto {
  @ApiProperty({ description: 'Deposit amount' })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: PaymentMethod, description: 'Payment method' })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}

export class WithdrawalRequestDto {
  @ApiProperty({ description: 'Withdrawal amount' })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ description: 'Destination address or account' })
  @IsString()
  destination!: string;

  @ApiProperty({ enum: PaymentMethod, description: 'Payment method' })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}
