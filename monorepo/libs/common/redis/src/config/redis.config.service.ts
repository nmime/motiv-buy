import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { RedisClusterConfig, RedisConfig, RedisDefaultConfig, RedisSentinelConfig } from '../type';
import { RedisMode } from '../const';

@Injectable()
export class RedisConfigService {
  static validationSchema: Joi.ObjectSchema = Joi.object({
    REDIS_MODE: Joi.string()
      .required()
      .allow(...Object.values(RedisMode))
      .default(RedisMode.Default),
    REDIS_HOSTS: Joi.string().required(),
    REDIS_PASSWORD: Joi.string().optional().allow(''),
    REDIS_DB: Joi.number().when('REDIS_MODE', {
      is: RedisMode.Cluster,
      then: Joi.forbidden(),
      otherwise: Joi.optional(),
    }),
    REDIS_SENTINEL_GROUP_IDENTIFIER: Joi.string().when('REDIS_MODE', {
      is: RedisMode.Sentinel,
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
  });

  constructor(protected readonly configService: ConfigService<Record<string, unknown>, true>) {}

  get config(): RedisConfig {
    const mode = this.configService.get<RedisMode>('REDIS_MODE');
    const { hosts } = this;
    const password = this.configService.get<string>('REDIS_PASSWORD');

    const factories: Record<RedisMode, () => RedisConfig> = {
      [RedisMode.Cluster]: () => {
        return {
          mode: RedisMode.Cluster,
          hosts,
          password,
        } as RedisClusterConfig;
      },
      [RedisMode.Sentinel]: () => {
        const db = this.configService.get<number>('REDIS_DB');
        const sentinelGroupIdentifier = this.configService.get<string>('REDIS_SENTINEL_GROUP_IDENTIFIER');

        return {
          mode: RedisMode.Sentinel,
          hosts,
          password,
          db,
          sentinelGroupIdentifier,
        } as RedisSentinelConfig;
      },
      [RedisMode.Default]: () => {
        return {
          mode: RedisMode.Default,
          hosts,
          password: this.configService.get<string>('REDIS_PASSWORD'),
          db: this.configService.get<number>('REDIS_DB'),
        } as RedisDefaultConfig;
      },
    };

    const factory = factories[mode];
    if (!factory) {
      throw new TypeError(`Invalid redis mode: ${mode}`);
    }

    return factory();
  }

  private get hosts(): { host: string; port: number }[] {
    return this.configService
      .get<string>('REDIS_HOSTS')
      .split(',')
      .map((host) => {
        const [hostName, port] = host.split(':');

        return {
          host: hostName,
          port: Number(port),
        };
      });
  }
}
