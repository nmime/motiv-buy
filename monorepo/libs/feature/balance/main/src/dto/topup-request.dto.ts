import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, Matches, MaxLength } from 'class-validator';
import { Cryptocurrency } from '@app/feature-payment-shared';

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
    enum: Cryptocurrency,
    example: Cryptocurrency.USDT,
  })
  @IsEnum(Cryptocurrency, {
    message: 'Currency must be a valid cryptocurrency',
  })
  currency!: Cryptocurrency;

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
