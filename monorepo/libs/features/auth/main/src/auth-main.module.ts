import { Module } from '@nestjs/common';
// import { AuthSharedModule } from '@app/feature-auth-shared';
import { AuthMainService } from './services';
import { AuthController } from './auth.controller';

@Module({
  imports: [/* AuthSharedModule */],
  controllers: [AuthController],
  providers: [AuthMainService],
  exports: [AuthMainService],
})
export class AuthMainModule {}
