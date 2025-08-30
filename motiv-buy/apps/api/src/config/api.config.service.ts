import Joi from 'joi';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ApiConfigService {
  static readonly validationSchema: Joi.ObjectSchema = Joi.object({
    AUTH_API_PORT: Joi.number().default(80),
    AUTH_API_BASE_URL: Joi.string().required(),
    AUTH_API_ENV_NAME: Joi.string().required(),
    IS_DEV: Joi.boolean().default(false),
    GRACEFUL_SHUTDOWN_ENABLED: Joi.boolean().default(false),
  });

  constructor(private readonly configService: ConfigService<Record<string, unknown>, true>) {}

  get gracefulShutdownEnabled() {
    return this.configService.get<string>('GRACEFUL_SHUTDOWN_ENABLED') === 'true';
  }

  get port() {
    return +this.configService.get<string>('AUTH_API_PORT');
  }

  get baseUrl() {
    return this.configService.get<string>('AUTH_API_BASE_URL');
  }

  get envName() {
    return this.configService.get<string>('AUTH_API_ENV_NAME');
  }

  get isDev() {
    return this.configService.get<string>('IS_DEV') === 'true';
  }
}
