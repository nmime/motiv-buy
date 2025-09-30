import { Module } from '@nestjs/common';
import { AuthService } from './service';
import { AuthSharedModule } from '@app/feature-auth-shared';
import { DatabaseModule } from '@app/database';

@Module({
  imports: [DatabaseModule, AuthSharedModule],
  controllers: [],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthMainModule {}
