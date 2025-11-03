import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Cryptocurrency } from '../enum/cryptocurrency.enum';
import { PaymentStatus } from '../enum/payment-status.enum';

/**
 * Response DTO for invoice operations
 * Returned when an invoice is created or retrieved
 */
export class InvoiceResponseDto {
  @ApiProperty({
    description: 'Unique invoice identifier',
    example: 'INV-123456789',
  })
  id!: string;

  @ApiProperty({
    description: 'Invoice amount in cryptocurrency units',
    example: '100.50',
  })
  amount!: string;

  @ApiProperty({
    description: 'Cryptocurrency used for the invoice',
    enum: Cryptocurrency,
    example: Cryptocurrency.USDT,
  })
  currency!: Cryptocurrency;

  @ApiProperty({
    description: 'Current status of the invoice',
    enum: PaymentStatus,
    example: PaymentStatus.Pending,
  })
  status!: PaymentStatus;

  @ApiProperty({
    description: 'Payment URL for the invoice',
    example: 'https://pay.cryptopay.com/invoice/...',
  })
  payUrl!: string;

  @ApiPropertyOptional({
    description: 'Invoice description',
    example: 'Payment for traffic order #12345',
  })
  description?: string;

  @ApiProperty({
    description: 'Invoice creation timestamp',
    example: '2025-11-02T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Invoice expiration timestamp',
    example: '2025-11-03T12:00:00.000Z',
  })
  expiresAt!: string;

  @ApiPropertyOptional({
    description: 'Invoice payment timestamp (if paid)',
    example: '2025-11-02T12:30:00.000Z',
  })
  paidAt?: string;
}

/**
 * Response DTO for transfer/withdrawal operations
 * Returned when a transfer is created or retrieved
 */
export class TransferResponseDto {
  @ApiProperty({
    description: 'Unique transfer identifier',
    example: 'TRF-987654321',
  })
  id!: string;

  @ApiProperty({
    description: 'Telegram user ID who initiated the transfer',
    example: '123456789',
  })
  userId!: string;

  @ApiProperty({
    description: 'Transfer amount in cryptocurrency units',
    example: '50.25',
  })
  amount!: string;

  @ApiProperty({
    description: 'Cryptocurrency used for the transfer',
    enum: Cryptocurrency,
    example: Cryptocurrency.USDT,
  })
  currency!: Cryptocurrency;

  @ApiProperty({
    description: 'Current status of the transfer',
    enum: PaymentStatus,
    example: PaymentStatus.Processing,
  })
  status!: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Transfer comment',
    example: 'Withdrawal to personal wallet',
  })
  comment?: string;

  @ApiProperty({
    description: 'Transfer creation timestamp',
    example: '2025-11-02T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'Transfer completion timestamp (if completed)',
    example: '2025-11-02T12:15:00.000Z',
  })
  completedAt?: string;

  @ApiPropertyOptional({
    description: 'Transaction hash on blockchain (if completed)',
    example: '0x1234567890abcdef...',
  })
  txHash?: string;
}

/**
 * Response DTO for balance queries
 * Returned when retrieving user balance information
 */
export class BalanceResponseDto {
  @ApiProperty({
    description: 'Telegram user ID',
    example: '123456789',
  })
  userId!: string;

  @ApiProperty({
    description: 'Available balances by cryptocurrency',
    example: {
      USDT: '150.75',
      TON: '25.00',
      BTC: '0.00125',
    },
  })
  balances!: Record<Cryptocurrency, string>;

  @ApiProperty({
    description: 'Total balance in USD equivalent',
    example: '1250.50',
  })
  totalUsd!: string;

  @ApiProperty({
    description: 'Pending deposits by cryptocurrency',
    example: {
      USDT: '10.00',
    },
  })
  pendingDeposits!: Record<Cryptocurrency, string>;

  @ApiProperty({
    description: 'Last transaction timestamp',
    example: '2025-11-02T12:00:00.000Z',
  })
  lastTransactionAt!: string;
}
