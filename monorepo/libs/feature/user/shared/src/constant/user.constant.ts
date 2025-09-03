/**
 * User domain constants
 */

/**
 * Dependency injection tokens
 */
export const USER_REPOSITORY = 'USER_REPOSITORY';

/**
 * User status enumeration
 */
export enum UserStatus {
  Active = 'active',
  Restricted = 'restricted',
  Banned = 'banned',
}

/**
 * User role enumeration
 */
export enum UserRole {
  User = 'user',
  Admin = 'admin',
  Developer = 'developer',
}