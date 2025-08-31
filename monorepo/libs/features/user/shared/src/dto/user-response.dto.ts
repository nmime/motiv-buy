import { UserStatus, UserRole } from '../constant/user.constant';

/**
 * DTO for user response data
 */
export class UserResponseDto {
  id!: string;
  firstName!: string;
  lastName!: string;
  email!: string;
  phoneNumber?: string;
  status!: UserStatus;
  role!: UserRole;
  createdAt!: Date;
  updatedAt!: Date;
}