import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Base payload structure for webhook updates
 */
export class WebhookPayloadDto {
  @ApiProperty({
    description: 'Unique identifier for the invoice or transfer',
    example: 'INV-123456',
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Current status of the transaction',
    example: 'paid',
  })
  @IsString()
  status!: string;

  @ApiProperty({
    description: 'Additional payload data (invoice or transfer specific)',
    example: {
      amount: '100.50',
      currency: 'USDT',
      pay_url: 'https://pay.cryptopay.com/invoice/...',
    },
  })
  @IsObject()
  data!: Record<string, unknown>;
}

/**
 * DTO for incoming webhook updates from payment provider
 * Validates the structure of webhook notifications
 */
export class WebhookUpdateDto {
  @ApiProperty({
    description: 'Type of update received',
    example: 'invoice_paid',
    enum: ['invoice_paid', 'invoice_expired', 'invoice_cancelled', 'transfer_completed', 'transfer_failed'],
  })
  @IsString()
  updateType!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp of the request',
    example: '2025-11-02T12:00:00.000Z',
  })
  @IsDateString(
    {},
    {
      message: 'requestDate must be a valid ISO 8601 date string',
    },
  )
  requestDate!: string;

  @ApiProperty({
    description: 'Payload containing invoice or transfer data',
    type: WebhookPayloadDto,
  })
  @ValidateNested()
  @Type(() => WebhookPayloadDto)
  payload!: WebhookPayloadDto;
}
