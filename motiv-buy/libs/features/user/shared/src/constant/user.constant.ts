/**
 * User domain constants
 */

/**
 * Dependency injection tokens
 */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

/**
 * User status enumeration
 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

/**
 * User role enumeration
 */
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}