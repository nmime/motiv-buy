import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiPropertyOptional({ description: 'Username' })
  username?: string;

  @ApiProperty({ description: 'First name' })
  firstName: string;

  @ApiPropertyOptional({ description: 'Last name' })
  lastName?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  email?: string;

  @ApiPropertyOptional({ description: 'Active status' })
  isActive?: boolean;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
}