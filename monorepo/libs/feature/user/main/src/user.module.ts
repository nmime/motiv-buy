import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { UserService } from './service';
import { UserMapper } from './mapper';

/**
 * User domain module - main implementation
 * Contains business logic and implementation details
 */
@Module({
  imports: [DatabaseModule],
  controllers: [],
  providers: [UserService, UserMapper],
  exports: [UserService, UserMapper],
})
export class UserMainModule {}
