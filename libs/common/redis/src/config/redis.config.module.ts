import { Global, Module } from '@nestjs/common';
import { RedisConfigService } from './redis.config.service';

@Global()
@Module({
  imports: [],
  providers: [RedisConfigService],
  exports: [RedisConfigService],
})
export class RedisConfigModule {}
