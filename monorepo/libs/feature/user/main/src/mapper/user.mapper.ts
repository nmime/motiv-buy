import { Injectable } from '@nestjs/common';

// Local interface to avoid cross-library imports
enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

interface UserResponseDto {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  status?: UserStatus;
  role?: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User mapper - data transformation utilities
 */
@Injectable()
export class UserMapper {
  /**
   * Convert data to UserResponseDto
   */
  toResponse(data: any): UserResponseDto {
    return {
      id: data.id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phoneNumber: data.phoneNumber,
      status: data.status,
      role: data.role,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  /**
   * Convert multiple data items to UserResponseDto array
   */
  toResponseArray(dataArray: any[]): UserResponseDto[] {
    return dataArray.map(data => this.toResponse(data));
  }
}