import { ApiProperty } from '@nestjs/swagger';

export class StatisticTokenDto {
  @ApiProperty({ description: 'Share token for public access' })
  shareToken: string;
}
