import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { UserService, SettingsService, SecurityService } from './service';
import { UserMapper } from './mapper';
import { UserController, SettingsController, SecurityController } from './controller';

/**
 * User domain module - main implementation
 * Contains business logic and implementation details
 */
@Module({
  imports: [DatabaseModule],
  controllers: [UserController, SettingsController, SecurityController],
  providers: [UserService, SettingsService, SecurityService, UserMapper],
  exports: [UserService, SettingsService, SecurityService, UserMapper],
})
export class UserMainModule {}
