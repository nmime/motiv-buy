import { Module } from '@nestjs/common';
import { UserController } from './controller/user.controller';
import { UserService } from './service/user.service';
import { UserRepositoryImpl } from './repository/user.repository.impl';
import { UserMapper } from './mapper/user.mapper';
import { USER_REPOSITORY } from '@app/user/shared';

/**
 * User domain module - main implementation
 * Contains business logic and implementation details
 */
@Module({
  controllers: [UserController],
  providers: [
    UserService,
    UserMapper,
    {
      provide: USER_REPOSITORY,
      useClass: UserRepositoryImpl,
    },
  ],
  exports: [UserService, USER_REPOSITORY],
})
export class UserModule {}
