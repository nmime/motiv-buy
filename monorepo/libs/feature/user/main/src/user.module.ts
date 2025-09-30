import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { UserController } from './controller';
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
  exports: [UserService],
})
export class UserMainModule {}
