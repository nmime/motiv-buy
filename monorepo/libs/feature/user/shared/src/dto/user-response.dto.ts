import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '../constant';

export class UserResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: 'uuid-user-id',
  })
  id!: string;

  @ApiProperty({
    description: 'Telegram user ID',
    example: '123456789',
  })
  telegramId!: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  firstName!: string;

  @ApiPropertyOptional({
    description: 'User last name',
    example: 'Doe',
  })
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Telegram username',
    example: 'johndoe',
  })
  username?: string;

  @ApiProperty({
    description: 'User status',
    enum: UserStatus,
    example: UserStatus.Active,
  })
  status!: UserStatus;

  @ApiPropertyOptional({
    description: 'User language code',
    example: 'en',
  })
  languageCode?: string;

  @ApiPropertyOptional({
    description: 'Referrer user telegram ID',
    example: '987654321',
  })
  referredBy?: string;

  @ApiProperty({
    description: 'Number of referrals made by user',
    example: 5,
  })
  referralCount!: number;

  @ApiProperty({
    description: 'User creation date',
    example: '2024-08-31T14:26:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'User last update date',
    example: '2024-08-31T14:26:00Z',
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'User last active date',
    example: '2024-09-01T10:30:00Z',
  })
  lastActiveAt?: Date;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    example: UserRole.User,
  })
  role!: UserRole;
}