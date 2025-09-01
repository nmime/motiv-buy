import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UserController } from './controller';
import { UserService } from './service';
import { UserRepositoryImpl } from './repository';
import { UserMapper } from './mapper';
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
export class UserMainModule {}
