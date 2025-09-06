import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class StatisticQueryDto {
  @ApiPropertyOptional({ enum: ['sale', 'purchase'], description: 'Type of statistic' })
  @IsOptional()
  @IsEnum(['sale', 'purchase'])
  type?: 'sale' | 'purchase';

  @ApiPropertyOptional({ description: 'Order ID to filter by' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Start date for filtering' })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date for filtering' })
  @IsOptional()
  @IsDateString()
  endDate?: Date;
}
