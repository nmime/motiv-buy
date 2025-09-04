import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from './service';
import { AuthController } from './controller';
import { AuthSharedModule } from '@app/feature-auth-shared';
import { DatabaseModule } from '@app/database';

@Module({
  imports: [
    DatabaseModule,
    AuthSharedModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 10,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
  ],
  exports: [AuthService],
})
export class AuthMainModule {}
