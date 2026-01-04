import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CurrencyCode } from '@app/database';

/**
 * Top-up request DTO
 * Creates a cryptocurrency invoice for balance top-up
 */
export class TopUpRequestDto {
  @ApiProperty({
    description: 'Amount to top-up in cryptocurrency units (positive decimal string)',
    example: '100.50',
    pattern: '^\\d+(\\.\\d+)?$',
  })
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'Amount must be a positive number string',
  })
  amount!: string;

  @ApiProperty({
    description: 'Cryptocurrency to use for the top-up',
    enum: CurrencyCode,
    example: CurrencyCode.Usdt,
  })
  @IsEnum(CurrencyCode, {
    message: 'Currency must be a valid currency code',
  })
  currency!: CurrencyCode;

  @ApiPropertyOptional({
    description: 'Optional description for the top-up',
    example: 'Balance top-up',
    maxLength: 1024,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  description?: string;
}
