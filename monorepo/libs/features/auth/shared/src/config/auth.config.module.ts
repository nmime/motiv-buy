import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthConfigService } from './auth.config.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema: AuthConfigService.validationSchema,
    }),
  ],
  providers: [AuthConfigService],
  exports: [AuthConfigService],
})
export class AuthConfigModule {}
