import { ApiProperty } from '@nestjs/swagger';

export class ShareTokenResponseDto {
  @ApiProperty({
    description: 'Generated share token',
    example: 'tra-abc123def456-1704067200000-uuid-random',
  })
  shareToken!: string;

  @ApiProperty({
    description: 'Complete shareable link',
    example: 'https://motivbuy.com/share/stats/tra-abc123def456-1704067200000-uuid-random',
  })
  shareLink!: string;

  @ApiProperty({
    description: 'Token expiration date',
    example: '2024-01-22T10:30:00Z',
  })
  expiresAt!: Date;
}
