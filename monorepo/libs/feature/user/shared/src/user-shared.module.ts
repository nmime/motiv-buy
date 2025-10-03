import { Module } from '@nestjs/common';

/**
 * User Shared Module
 *
 * Provides shared user-related utilities and cross-domain reusable components.
 * API DTOs and business logic should be in the main user library.
 */
@Module({
  imports: [],
  providers: [],
  exports: [],
})
export class UserSharedModule {}
