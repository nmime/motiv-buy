import { Injectable } from '@nestjs/common';
import { UserEntity, UserRole, UserStatus } from '@app/database';

interface UserResponseDto {
  id: string;
  telegramId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  status: UserStatus;
  languageCode?: string;
  referredBy?: string;
  referralCount: number;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt?: Date;
}

@Injectable()
export class UserMapper {
  toResponse(user: UserEntity): UserResponseDto {
    return {
      id: user.id,
      telegramId: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      status: user.status,
      languageCode: user.languageCode,
      referredBy: user.referredBy,
      referralCount: user.referralCount,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastActiveAt: user.lastActiveAt,
    };
  }

  toResponseArray(users: UserEntity[]): UserResponseDto[] {
    return users.map((user) => this.toResponse(user));
  }
}
