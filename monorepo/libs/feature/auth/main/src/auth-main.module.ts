import { Module } from '@nestjs/common';
import { AuthService } from './services';
import { AuthController } from './auth.controller';
import { AuthSharedModule } from '@app/feature-auth-shared';
import { DatabaseModule } from '@app/database';

@Module({
  imports: [
    DatabaseModule,
    AuthSharedModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
  ],
  exports: [AuthService],
})
export class AuthMainModule {}
