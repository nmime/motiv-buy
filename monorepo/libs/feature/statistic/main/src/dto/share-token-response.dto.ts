import { ApiProperty } from '@nestjs/swagger';

/**
 * Share token response DTO for public statistics access
 */
export class ShareTokenResponseDto {
  @ApiProperty({
    description: 'Generated share token for public access',
    example: 'tra-user123-1704067200000-abc123def456',
  })
  token!: string;

  @ApiProperty({
    description: 'Direct URL for accessing shared statistics',
    example: 'https://api.example.com/public/statistics/summary/tra-user123-1704067200000-abc123def456',
  })
  shareUrl!: string;

  @ApiProperty({
    description: 'Token expiration date (7 days from generation)',
    example: '2024-01-08T12:00:00Z',
  })
  expiresAt!: Date;

  @ApiProperty({
    description: 'Token creation date',
    example: '2024-01-01T12:00:00Z',
  })
  createdAt!: Date;
}
