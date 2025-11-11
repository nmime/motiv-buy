import { ApiProperty } from '@nestjs/swagger';

export class LoginHistoryResponseDto {
  @ApiProperty({ example: '2025-11-07T10:30:00Z', description: 'Login timestamp' })
  timestamp!: Date;

  // eslint-disable-next-line sonarjs/no-hardcoded-ip
  @ApiProperty({ example: '192.168.1.1', description: 'IP address' })
  ipAddress!: string;

  @ApiProperty({ example: 'Chrome 118.0 / macOS', description: 'User agent / device info' })
  userAgent!: string;

  @ApiProperty({ example: 'New York, US', description: 'Approximate location' })
  location?: string;

  @ApiProperty({ example: true, description: 'Whether login was successful' })
  success!: boolean;
}

export class SecurityOverviewResponseDto {
  @ApiProperty({ example: '2025-11-07T10:30:00Z', description: 'Last login timestamp' })
  lastLogin!: Date;

  // eslint-disable-next-line sonarjs/no-hardcoded-ip
  @ApiProperty({ example: '192.168.1.1', description: 'Last login IP' })
  lastLoginIp!: string;

  @ApiProperty({ example: 5, description: 'Total number of active sessions' })
  activeSessions!: number;

  @ApiProperty({ example: 12, description: 'Total login count in last 30 days' })
  loginCount!: number;

  @ApiProperty({ example: 0, description: 'Failed login attempts in last 24h' })
  failedAttempts!: number;

  @ApiProperty({ example: true, description: 'Whether 2FA is enabled' })
  twoFactorEnabled!: boolean;
}
