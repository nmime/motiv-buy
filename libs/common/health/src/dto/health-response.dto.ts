import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({
    description: 'Health check status',
    example: 'ok',
    enum: ['ok', 'ready', 'alive'],
  })
  status!: string;

  @ApiProperty({
    description: 'Timestamp of health check',
    example: '2025-10-02T18:00:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({
    description: 'Process uptime in seconds',
    example: 3600,
    required: false,
  })
  uptime?: number;

  @ApiProperty({
    description: 'Current environment',
    example: 'production',
    required: false,
  })
  environment?: string;
}

// Schema for Swagger documentation
export const HealthResponseDtoSchema = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['ok', 'ready', 'alive'],
      example: 'ok',
    },
    timestamp: {
      type: 'string',
      example: '2025-10-02T18:00:00.000Z',
    },
    uptime: {
      type: 'number',
      example: 3600,
    },
    environment: {
      type: 'string',
      example: 'production',
    },
  },
};
