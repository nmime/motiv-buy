import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import Joi from 'joi';

@Injectable()
export class AuthConfigService {
  static readonly validationSchema: Joi.ObjectSchema = Joi.object({
    IS_DEV: Joi.boolean().default(false),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    JWT_SECRET: Joi.string().required(),
    BOT_TOKEN: Joi.string().required(),
    ALLOW_TO_ENTER_TG_IDS: Joi.string().allow('').optional().default(''),
    ALLOWED_IPS: Joi.string().allow('').optional().default('127.0.0.1,::1'),
    SKIP_AUTH_IP_CHECK: Joi.boolean().default(false),
  });

  constructor(private readonly configService: ConfigService<Record<string, unknown>, true>) {}

  get jwtSecret(): string {
    return this.configService.get<string>('JWT_SECRET') || 'development_secret_key';
  }

  get botToken(): string {
    return this.configService.get<string>('BOT_TOKEN') || '';
  }

  get isDev(): boolean {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const isDev = this.configService.get<string>('IS_DEV');
    return nodeEnv === 'development' || isDev === 'true';
  }

  get allowTgIds(): string[] {
    const tgIds = this.configService.get<string>('ALLOW_TO_ENTER_TG_IDS') ?? '';
    return tgIds.split(',').map((id) => id.trim()).filter(Boolean);
  }

  get allowedDevIPs(): string[] {
    const ips = this.configService.get<string>('ALLOWED_IPS') ?? '127.0.0.1,::1';
    return ips.split(',').map((ip) => ip.trim()).filter(Boolean);
  }

  get allowedIps(): string[] {
    return this.allowedDevIPs;
  }

  get skipIpCheck(): boolean {
    return this.configService.get<string>('SKIP_AUTH_IP_CHECK') === 'true';
  }

  get jwtExpiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN') ?? '1d';
  }

  get cacheEnabled(): boolean {
    return this.configService.get<string>('AUTH_CACHE_ENABLED') !== 'false';
  }
}
