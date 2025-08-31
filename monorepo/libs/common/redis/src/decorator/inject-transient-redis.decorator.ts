import { RedisInjectTransientToken } from '../const';
import { Inject } from '@nestjs/common';

export const InjectTransientRedis = () => Inject(RedisInjectTransientToken);
