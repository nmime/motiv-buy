import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsInt, Min, Max, MaxLength, Matches } from 'class-validator';
import { Cryptocurrency } from '../enum/cryptocurrency.enum';

/**
 * DTO for creating payment invoices
 * Used to generate payment links for users to deposit funds
 */
export class CreateInvoiceDto {
  @ApiProperty({
    description: 'Amount to charge in cryptocurrency units (positive decimal string)',
    example: '100.50',
    pattern: '^\\d+(\\.\\d+)?$',
  })
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'Amount must be a positive number string',
  })
  amount!: string;

  @ApiProperty({
    description: 'Cryptocurrency to use for the invoice',
    enum: Cryptocurrency,
    example: Cryptocurrency.Usdt,
  })
  @IsEnum(Cryptocurrency, {
    message: 'Currency must be a valid cryptocurrency',
  })
  currency!: Cryptocurrency;

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
}
