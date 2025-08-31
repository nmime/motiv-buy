import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UserController } from './controller/user.controller';
import { UserService } from './service/user.service';
import { UserRepositoryImpl } from './repository/user.repository.impl';
import { UserMapper } from './mapper/user.mapper';
import { USER_REPOSITORY } from '@app/feature-user-shared';
import { 
  UserEntity,
  UserBalanceEntity,
  UserSettingsEntity,
  UserSourceVisitEntity 
} from '@app/database';

/**
 * User domain module - main implementation
 * Contains business logic and implementation details
 */
@Module({
  imports: [
    MikroOrmModule.forFeature([
      UserEntity,
      UserBalanceEntity,
      UserSettingsEntity,
      UserSourceVisitEntity
    ])
  ],
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
