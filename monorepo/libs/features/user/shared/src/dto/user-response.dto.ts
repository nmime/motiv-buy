import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus, UserRole } from '../constant/user.constant';

/**
 * DTO for user response data
 */
export class UserResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: 'uuid-user-id',
  })
  id!: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  firstName!: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  lastName!: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  email!: string;

  @ApiPropertyOptional({
    description: 'User phone number',
    example: '+1234567890',
  })
  phoneNumber?: string;

  @ApiProperty({
    description: 'User status',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  status!: UserStatus;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    example: UserRole.USER,
  })
  role!: UserRole;

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
}