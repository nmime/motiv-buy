import { RedisInjectToken } from '../const';
import { Inject } from '@nestjs/common';

export const InjectRedis = () => Inject(RedisInjectToken);
