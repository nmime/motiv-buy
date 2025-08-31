import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import Joi from 'joi';

@Injectable()
export class AuthConfigService {
  static readonly validationSchema: Joi.ObjectSchema = Joi.object({
    IS_DEV: Joi.boolean().default(false),
    JWT_SECRET: Joi.string().required(),
    BOT_TOKEN: Joi.string().required(),
    ALLOW_TO_ENTER_TG_IDS: Joi.string().allow('').optional().default(''),
    ALLOWED_IPS: Joi.string().allow('').optional().default(''),
    SKIP_AUTH_IP_CHECK: Joi.boolean().default(false),
  });

  constructor(private readonly configService: ConfigService<Record<string, unknown>, true>) {}

  get jwtSecret() {
    return this.configService.get<string>('JWT_SECRET');
  }

  get botToken() {
    return this.configService.get<string>('BOT_TOKEN');
  }

  get isDev() {
    return this.configService.get<string>('IS_DEV') === 'true';
  }

  get allowTgIds() {
    return (this.configService.get<string>('ALLOW_TO_ENTER_TG_IDS') ?? '').split(',').map((ip) => ip.trim());
  }

  get allowedIps() {
    return (this.configService.get<string>('ALLOWED_IPS') ?? '').split(',').map((ip) => ip.trim());
  }

  get skipIpCheck(): boolean {
    return this.configService.get<string>('SKIP_AUTH_IP_CHECK') === 'true';
  }
}
