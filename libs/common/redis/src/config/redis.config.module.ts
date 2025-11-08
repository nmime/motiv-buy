import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisConfigService } from './redis.config.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema: RedisConfigService.validationSchema,
    }),
  ],
  providers: [RedisConfigService],
  exports: [RedisConfigService],
})
export class RedisConfigModule {}
